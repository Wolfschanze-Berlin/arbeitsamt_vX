use std::sync::Arc;

use dashmap::DashMap;
use russh_sftp::client::SftpSession;
use serde::Serialize;
use tokio::sync::{mpsc, Mutex};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::error::SshError;
use crate::ssh::handler::{ClientHandler, ForwardingTable};

/// Info about an active SSH connection (serializable for frontend)
#[derive(Debug, Clone, Serialize)]
pub struct ConnectionInfo {
    pub session_id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
}

/// Commands sent to the TerminalActor
#[derive(Debug)]
pub enum TerminalCommand {
    Data(Vec<u8>),
    Resize { cols: u16, rows: u16 },
    Close,
}

/// An active SSH connection entry in the session map
pub struct ActiveConnection {
    pub info: ConnectionInfo,
    pub cmd_tx: mpsc::UnboundedSender<TerminalCommand>,
    pub cancel: CancellationToken,
    /// The russh client handle, kept alive for opening additional channels (e.g. SFTP).
    /// Wrapped in `Arc<Mutex>` because `Handle` is `!Sync` (contains `UnboundedReceiver`).
    pub ssh_handle: Arc<Mutex<russh::client::Handle<ClientHandler>>>,
    /// Remote forwarding table shared with the ClientHandler.
    /// Maps remote_port -> (local_host, local_port).
    pub forwarding_table: ForwardingTable,
}

/// Manages all SSH sessions concurrently using DashMap (no Mutex bottleneck)
pub struct SshManager {
    sessions: DashMap<String, ActiveConnection>,
    /// Cached SFTP sessions, opened on demand via the SSH handle.
    sftp_sessions: DashMap<String, Arc<SftpSession>>,
}

impl SshManager {
    pub fn new() -> Self {
        Self {
            sessions: DashMap::new(),
            sftp_sessions: DashMap::new(),
        }
    }

    /// Register a new session after connection is established.
    /// Called by the connect flow after TCP+auth+channel setup.
    pub fn register_session(
        &self,
        info: ConnectionInfo,
        cmd_tx: mpsc::UnboundedSender<TerminalCommand>,
        cancel: CancellationToken,
        ssh_handle: russh::client::Handle<ClientHandler>,
        forwarding_table: ForwardingTable,
    ) -> String {
        let session_id = info.session_id.clone();
        self.sessions.insert(
            session_id.clone(),
            ActiveConnection {
                info,
                cmd_tx,
                cancel,
                ssh_handle: Arc::new(Mutex::new(ssh_handle)),
                forwarding_table,
            },
        );
        session_id
    }

    /// Send data (keystrokes) to a session's terminal actor.
    /// This is called on EVERY keystroke -- must be fast (DashMap lookup + channel send).
    pub fn send_data(&self, session_id: &str, data: Vec<u8>) -> Result<(), SshError> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| SshError::SessionNotFound(session_id.to_string()))?;
        session
            .cmd_tx
            .send(TerminalCommand::Data(data))
            .map_err(|_| SshError::ChannelClosed("Terminal actor stopped".to_string()))
    }

    /// Send resize event to a session's terminal actor.
    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), SshError> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| SshError::SessionNotFound(session_id.to_string()))?;
        session
            .cmd_tx
            .send(TerminalCommand::Resize { cols, rows })
            .map_err(|_| SshError::ChannelClosed("Terminal actor stopped".to_string()))
    }

    /// Disconnect a session: cancel its actor and remove from map.
    /// Also removes any cached SFTP session.
    pub fn disconnect(&self, session_id: &str) -> Result<(), SshError> {
        self.sftp_sessions.remove(session_id);
        if let Some((_, conn)) = self.sessions.remove(session_id) {
            conn.cancel.cancel();
            let _ = conn.cmd_tx.send(TerminalCommand::Close);
            Ok(())
        } else {
            Err(SshError::SessionNotFound(session_id.to_string()))
        }
    }

    /// Remove a session from the map without cancelling.
    /// Called by the cleanup task after the TerminalActor exits
    /// (e.g., due to keepalive timeout or server-side disconnect).
    /// Returns true if the session was present and removed.
    pub fn remove_session(&self, session_id: &str) -> bool {
        self.sftp_sessions.remove(session_id);
        self.sessions.remove(session_id).is_some()
    }

    /// List all active sessions.
    pub fn list_sessions(&self) -> Vec<ConnectionInfo> {
        self.sessions
            .iter()
            .map(|entry| entry.info.clone())
            .collect()
    }

    /// Generate a new unique session ID.
    pub fn generate_session_id() -> String {
        Uuid::new_v4().to_string()
    }

    /// Get the SSH handle for a session (used for opening additional channels,
    /// e.g. direct-tcpip for port forwarding).
    pub fn get_ssh_handle(
        &self,
        session_id: &str,
    ) -> Result<Arc<Mutex<russh::client::Handle<ClientHandler>>>, SshError> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| SshError::SessionNotFound(session_id.to_string()))?;
        Ok(session.ssh_handle.clone())
    }

    /// Get the forwarding table for a session (used for remote port forwarding).
    pub fn get_forwarding_table(
        &self,
        session_id: &str,
    ) -> Result<ForwardingTable, SshError> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| SshError::SessionNotFound(session_id.to_string()))?;
        Ok(session.forwarding_table.clone())
    }

    /// Get or create an SFTP session for the given SSH session.
    /// Opens the SFTP subsystem on demand using the stored SSH handle.
    pub async fn get_sftp_session(
        &self,
        session_id: &str,
    ) -> Result<Arc<SftpSession>, SshError> {
        // Return cached session if available
        if let Some(sftp) = self.sftp_sessions.get(session_id) {
            return Ok(sftp.clone());
        }

        // Get the SSH handle to open a new SFTP channel
        let ssh_handle = {
            let session = self
                .sessions
                .get(session_id)
                .ok_or_else(|| SshError::SessionNotFound(session_id.to_string()))?;
            session.ssh_handle.clone()
        };

        let handle = ssh_handle.lock().await;

        // Open a new session channel for SFTP
        let channel = handle
            .channel_open_session()
            .await
            .map_err(|e| SshError::SftpError(format!("Failed to open SFTP channel: {}", e)))?;

        // Request the SFTP subsystem
        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|e| {
                SshError::SftpError(format!("Failed to request SFTP subsystem: {}", e))
            })?;

        // Create the SFTP session from the channel stream
        let sftp = SftpSession::new(channel.into_stream())
            .await
            .map_err(|e| SshError::SftpError(format!("Failed to initialize SFTP session: {}", e)))?;

        let sftp = Arc::new(sftp);
        self.sftp_sessions.insert(session_id.to_string(), sftp.clone());
        Ok(sftp)
    }

    /// Close and remove a cached SFTP session.
    pub async fn close_sftp_session(&self, session_id: &str) -> Result<(), SshError> {
        if let Some((_, sftp)) = self.sftp_sessions.remove(session_id) {
            let _ = sftp.close().await;
        }
        Ok(())
    }
}
