// Remote (reverse) port forwarding — Wave 5
//
// The server listens on a remote port and forwards incoming connections back
// through the SSH tunnel to a local host:port.

use std::sync::Arc;

use serde::Serialize;
use tokio::sync::Mutex;

use crate::error::SshError;
use crate::ssh::handler::ClientHandler;

/// Information about an active remote (reverse) tunnel, serialized for the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct RemoteTunnelInfo {
    pub tunnel_id: String,
    pub session_id: String,
    pub remote_port: u32,
    pub local_host: String,
    pub local_port: u16,
    pub active: bool,
}

/// Send a `tcpip-forward` global request to the SSH server, asking it to listen
/// on the given remote port and forward connections back to us.
///
/// The server may assign a different port if `remote_port` is 0; the actually
/// bound port is returned.
pub async fn request_remote_forward(
    ssh_handle: &Arc<Mutex<russh::client::Handle<ClientHandler>>>,
    remote_port: u32,
) -> Result<u32, SshError> {
    let mut handle = ssh_handle.lock().await;
    let bound_port = handle
        .tcpip_forward("0.0.0.0", remote_port)
        .await
        .map_err(|e| {
            SshError::TunnelError(format!(
                "Failed to request remote forward on port {}: {}",
                remote_port, e
            ))
        })?;

    // russh returns 0 when we asked for a specific port (meaning "same port"),
    // and returns the actual port when we asked for 0 (wildcard).
    let actual_port = if bound_port == 0 { remote_port } else { bound_port };

    log::info!(
        "Remote forward established: server listening on port {}",
        actual_port
    );

    Ok(actual_port)
}

/// Send a `cancel-tcpip-forward` global request to ask the server to stop
/// listening on the given remote port.
pub async fn cancel_remote_forward(
    ssh_handle: &Arc<Mutex<russh::client::Handle<ClientHandler>>>,
    remote_port: u32,
) -> Result<(), SshError> {
    let handle = ssh_handle.lock().await;
    handle
        .cancel_tcpip_forward("0.0.0.0", remote_port)
        .await
        .map_err(|e| {
            SshError::TunnelError(format!(
                "Failed to cancel remote forward on port {}: {}",
                remote_port, e
            ))
        })?;

    log::info!(
        "Remote forward cancelled: server stopped listening on port {}",
        remote_port
    );

    Ok(())
}
