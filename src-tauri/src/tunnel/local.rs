// Local port forwarding — binds a local TCP port and forwards traffic through
// the SSH connection to a remote host:port via direct-tcpip channels.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use serde::Serialize;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::Mutex;
use tokio::time::Duration;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::error::SshError;
use crate::ssh::handler::ClientHandler;

/// Metadata for an active local port-forwarding tunnel (serializable for the frontend).
#[derive(Debug, Clone, Serialize)]
pub struct TunnelInfo {
    pub tunnel_id: String,
    pub session_id: String,
    pub local_port: u16,
    pub remote_host: String,
    pub remote_port: u16,
    pub active: bool,
}

/// Start local port forwarding: bind `127.0.0.1:local_port`, and for each
/// accepted TCP connection open a `direct-tcpip` SSH channel to
/// `remote_host:remote_port`, then bridge bytes bidirectionally.
///
/// The returned `TunnelInfo` describes the tunnel. Cancelling `cancel` will
/// stop the listener and drain in-flight connections (up to 5 s).
pub async fn start_local_forward(
    ssh_handle: Arc<Mutex<russh::client::Handle<ClientHandler>>>,
    session_id: String,
    local_port: u16,
    remote_host: String,
    remote_port: u16,
    cancel: CancellationToken,
) -> Result<TunnelInfo, SshError> {
    let tunnel_id = Uuid::new_v4().to_string();

    // Bind the local listener.
    let listener = TcpListener::bind(format!("127.0.0.1:{}", local_port))
        .await
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::AddrInUse {
                SshError::TunnelError(format!(
                    "Port {} is already in use on 127.0.0.1",
                    local_port
                ))
            } else {
                SshError::TunnelError(format!(
                    "Failed to bind 127.0.0.1:{}: {}",
                    local_port, e
                ))
            }
        })?;

    let info = TunnelInfo {
        tunnel_id: tunnel_id.clone(),
        session_id: session_id.clone(),
        local_port,
        remote_host: remote_host.clone(),
        remote_port,
        active: true,
    };

    // Counter for in-flight connections (used for graceful drain on cancel).
    let active_conns = Arc::new(AtomicUsize::new(0));

    // Spawn the accept loop.
    let accept_cancel = cancel.clone();
    let drain_conns = active_conns.clone();
    let t_id = tunnel_id.clone();
    tokio::spawn(async move {
        log::info!(
            "Tunnel {}: listening on 127.0.0.1:{} -> {}:{}",
            t_id,
            local_port,
            remote_host,
            remote_port
        );

        loop {
            tokio::select! {
                biased;

                _ = accept_cancel.cancelled() => {
                    log::info!("Tunnel {}: cancel received, stopping listener", t_id);
                    break;
                }

                result = listener.accept() => {
                    match result {
                        Ok((tcp_stream, peer_addr)) => {
                            log::debug!(
                                "Tunnel {}: accepted connection from {}",
                                t_id,
                                peer_addr
                            );

                            // Open a direct-tcpip channel through SSH.
                            let channel = {
                                let handle = ssh_handle.lock().await;
                                handle.channel_open_direct_tcpip(
                                    remote_host.clone(),
                                    remote_port as u32,
                                    peer_addr.ip().to_string(),
                                    peer_addr.port() as u32,
                                ).await
                            };

                            let channel = match channel {
                                Ok(ch) => ch,
                                Err(e) => {
                                    log::error!(
                                        "Tunnel {}: failed to open direct-tcpip channel: {}",
                                        t_id,
                                        e
                                    );
                                    continue;
                                }
                            };

                            // Track in-flight connection count.
                            active_conns.fetch_add(1, Ordering::Relaxed);
                            let conn_counter = active_conns.clone();
                            let conn_cancel = accept_cancel.clone();
                            let conn_tid = t_id.clone();

                            tokio::spawn(async move {
                                if let Err(e) = bridge_streams(
                                    tcp_stream,
                                    channel,
                                    conn_cancel,
                                ).await {
                                    log::debug!(
                                        "Tunnel {}: bridge closed: {}",
                                        conn_tid,
                                        e
                                    );
                                }
                                conn_counter.fetch_sub(1, Ordering::Relaxed);
                            });
                        }
                        Err(e) => {
                            log::error!("Tunnel {}: accept error: {}", t_id, e);
                            // Transient accept errors — continue unless cancelled.
                        }
                    }
                }
            }
        }

        // Drain: wait up to 5 seconds for in-flight connections to finish.
        let deadline = tokio::time::Instant::now() + Duration::from_secs(5);
        while drain_conns.load(Ordering::Relaxed) > 0
            && tokio::time::Instant::now() < deadline
        {
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        let remaining = drain_conns.load(Ordering::Relaxed);
        if remaining > 0 {
            log::warn!(
                "Tunnel {}: drain timeout, {} connections still active",
                t_id,
                remaining
            );
        }

        log::info!("Tunnel {}: stopped", t_id);
    });

    Ok(info)
}

/// Bidirectional copy between a local TCP stream and an SSH direct-tcpip channel.
///
/// Uses a manual `tokio::select!` loop that mirrors the pattern from the russh
/// `client_open_direct_tcpip` example, reading from both the TCP socket and the
/// SSH channel concurrently and copying data in each direction.
async fn bridge_streams(
    mut tcp: tokio::net::TcpStream,
    mut channel: russh::Channel<russh::client::Msg>,
    cancel: CancellationToken,
) -> Result<(), SshError> {
    let mut tcp_closed = false;
    let mut buf = vec![0u8; 65536];

    loop {
        tokio::select! {
            biased;

            _ = cancel.cancelled() => {
                let _ = channel.eof().await;
                break;
            }

            // TCP -> SSH
            r = tcp.read(&mut buf), if !tcp_closed => {
                match r {
                    Ok(0) => {
                        tcp_closed = true;
                        let _ = channel.eof().await;
                    }
                    Ok(n) => {
                        channel.data(&buf[..n]).await.map_err(|e| {
                            SshError::TunnelError(format!("SSH channel write failed: {}", e))
                        })?;
                    }
                    Err(e) => {
                        let _ = channel.eof().await;
                        return Err(SshError::TunnelError(format!("TCP read error: {}", e)));
                    }
                }
            }

            // SSH -> TCP
            msg = channel.wait() => {
                match msg {
                    Some(russh::ChannelMsg::Data { ref data }) => {
                        tcp.write_all(data).await.map_err(|e| {
                            SshError::TunnelError(format!("TCP write error: {}", e))
                        })?;
                    }
                    Some(russh::ChannelMsg::Eof) => {
                        // Remote side signalled EOF — close our direction too.
                        if !tcp_closed {
                            let _ = channel.eof().await;
                        }
                        break;
                    }
                    Some(russh::ChannelMsg::WindowAdjusted { .. }) => {
                        // Flow-control notification — nothing to do.
                    }
                    None => {
                        // Channel dropped.
                        break;
                    }
                    _ => {
                        // Ignore other message types.
                    }
                }
            }
        }
    }

    Ok(())
}
