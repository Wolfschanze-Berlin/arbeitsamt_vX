// Minimal russh client handler shared across SSH and SFTP subsystems.
// Extended with remote port forwarding support (forwarded-tcpip callback).

use std::sync::Arc;

use dashmap::DashMap;

use crate::error::SshError;

/// Mapping from remote_port -> (local_host, local_port) for remote forwarding.
/// Shared between the handler (which receives forwarded-tcpip channels from the server)
/// and the command layer (which populates the table when the user requests forwarding).
pub type ForwardingTable = Arc<DashMap<u32, (String, u16)>>;

/// Russh client handler that accepts all host keys and handles remote forwarding.
/// Proper TOFU verification via KnownHostsStore will be wired in a later phase.
pub struct ClientHandler {
    /// Table of remote_port -> (local_host, local_port) for reverse tunnels.
    /// When the server opens a forwarded-tcpip channel on a registered port,
    /// we connect to the corresponding local endpoint and bridge data.
    pub forwarding_table: ForwardingTable,
}

impl ClientHandler {
    /// Create a new handler with an empty forwarding table.
    pub fn new() -> Self {
        Self {
            forwarding_table: Arc::new(DashMap::new()),
        }
    }

    /// Create a new handler with a pre-existing forwarding table.
    /// This allows the command layer to share the same table.
    pub fn with_forwarding_table(table: ForwardingTable) -> Self {
        Self {
            forwarding_table: table,
        }
    }
}

impl russh::client::Handler for ClientHandler {
    type Error = SshError;

    fn check_server_key(
        &mut self,
        _server_public_key: &russh::keys::PublicKey,
    ) -> impl std::future::Future<Output = Result<bool, Self::Error>> + Send {
        async { Ok(true) }
    }

    /// Called when the server opens a channel for a remote port forwarding connection.
    /// We look up the remote port in our forwarding table to find the local target,
    /// then spawn a task to bridge the SSH channel with a local TCP connection.
    fn server_channel_open_forwarded_tcpip(
        &mut self,
        channel: russh::Channel<russh::client::Msg>,
        _connected_address: &str,
        connected_port: u32,
        _originator_address: &str,
        _originator_port: u32,
        _session: &mut russh::client::Session,
    ) -> impl std::future::Future<Output = Result<(), Self::Error>> + Send {
        let table = self.forwarding_table.clone();

        async move {
            // Look up which local host:port this remote port should forward to.
            let (local_host, local_port) = match table.get(&connected_port) {
                Some(entry) => entry.value().clone(),
                None => {
                    log::warn!(
                        "Received forwarded-tcpip for unregistered remote port {}; ignoring",
                        connected_port
                    );
                    return Ok(());
                }
            };

            log::info!(
                "Remote forward: incoming connection on remote port {} -> {}:{}",
                connected_port,
                local_host,
                local_port
            );

            // Spawn the bridge task so we don't block the handler callback.
            tokio::spawn(async move {
                let tcp_result =
                    tokio::net::TcpStream::connect(format!("{}:{}", local_host, local_port)).await;

                let mut tcp_stream = match tcp_result {
                    Ok(s) => s,
                    Err(e) => {
                        log::error!(
                            "Failed to connect to local {}:{} for remote forward: {}",
                            local_host,
                            local_port,
                            e
                        );
                        return;
                    }
                };

                // Convert the SSH channel into an AsyncRead + AsyncWrite stream.
                let mut channel_stream = channel.into_stream();

                // Bridge bidirectionally until one side closes.
                match tokio::io::copy_bidirectional(&mut tcp_stream, &mut channel_stream).await {
                    Ok((to_local, to_remote)) => {
                        log::debug!(
                            "Remote forward bridge closed (port {}): {} bytes to local, {} bytes to remote",
                            connected_port,
                            to_local,
                            to_remote
                        );
                    }
                    Err(e) => {
                        log::debug!(
                            "Remote forward bridge error (port {}): {}",
                            connected_port,
                            e
                        );
                    }
                }
            });

            Ok(())
        }
    }
}
