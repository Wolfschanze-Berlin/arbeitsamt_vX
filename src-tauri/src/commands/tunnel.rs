// Tunnel Tauri commands — local port forwarding

use tauri::State;
use tokio_util::sync::CancellationToken;

use uuid::Uuid;

use crate::error::SshError;
use crate::state::AppState;
use crate::tunnel::local::{self, TunnelInfo};
use crate::tunnel::remote::{self, RemoteTunnelInfo};

/// Wrapper that makes a `!Send` future usable in contexts requiring `Send`.
///
/// # Safety
/// See the identical wrapper in `commands/ssh.rs` for rationale. The caller
/// must ensure the future is only polled from a single thread (guaranteed by
/// Tokio's task model).
struct AssertSend<F>(F);

unsafe impl<F: std::future::Future> Send for AssertSend<F> {}

impl<F: std::future::Future> std::future::Future for AssertSend<F> {
    type Output = F::Output;

    fn poll(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Self::Output> {
        let inner = unsafe { self.map_unchecked_mut(|s| &mut s.0) };
        inner.poll(cx)
    }
}

/// Start a local port-forwarding tunnel.
///
/// Binds `127.0.0.1:local_port` and forwards each accepted connection through
/// the SSH session identified by `session_id` to `remote_host:remote_port`.
#[tauri::command]
pub async fn tunnel_local_forward(
    state: State<'_, AppState>,
    session_id: String,
    local_port: u16,
    remote_host: String,
    remote_port: u16,
) -> Result<TunnelInfo, SshError> {
    AssertSend(async {
        // Retrieve the SSH handle for this session.
        let ssh_handle = state.ssh_manager.get_ssh_handle(&session_id)?;

        let cancel = CancellationToken::new();

        let info = local::start_local_forward(
            ssh_handle,
            session_id,
            local_port,
            remote_host,
            remote_port,
            cancel.clone(),
        )
        .await?;

        // Store cancellation token and tunnel info for later management.
        state
            .tunnel_cancels
            .insert(info.tunnel_id.clone(), cancel);
        state
            .tunnel_infos
            .insert(info.tunnel_id.clone(), info.clone());

        Ok(info)
    })
    .await
}

/// Stop an active tunnel by its tunnel ID.
#[tauri::command]
pub async fn tunnel_stop(
    state: State<'_, AppState>,
    tunnel_id: String,
) -> Result<(), SshError> {
    if let Some((_, token)) = state.tunnel_cancels.remove(&tunnel_id) {
        token.cancel();
        // Mark the tunnel as inactive in the info map.
        if let Some(mut info) = state.tunnel_infos.get_mut(&tunnel_id) {
            info.active = false;
        }
        Ok(())
    } else {
        Err(SshError::TunnelError(format!(
            "No active tunnel with id: {}",
            tunnel_id
        )))
    }
}

/// List all active tunnels for a given SSH session.
#[tauri::command]
pub async fn tunnel_list(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Vec<TunnelInfo>, SshError> {
    let tunnels: Vec<TunnelInfo> = state
        .tunnel_infos
        .iter()
        .filter(|entry| entry.value().session_id == session_id && entry.value().active)
        .map(|entry| entry.value().clone())
        .collect();
    Ok(tunnels)
}

// ---------------------------------------------------------------------------
// Remote (reverse) port forwarding commands
// ---------------------------------------------------------------------------

/// Start a remote (reverse) port forward.
///
/// Adds an entry to the session's forwarding table (so the handler knows where
/// to route incoming forwarded-tcpip channels), then sends a `tcpip-forward`
/// global request to the SSH server.
#[tauri::command]
pub async fn tunnel_remote_forward(
    state: State<'_, AppState>,
    session_id: String,
    remote_port: u32,
    local_host: String,
    local_port: u16,
) -> Result<RemoteTunnelInfo, SshError> {
    // 1. Get the forwarding table and SSH handle for this session.
    let forwarding_table = state.ssh_manager.get_forwarding_table(&session_id)?;
    let ssh_handle = state.ssh_manager.get_ssh_handle(&session_id)?;

    // 2. Register the mapping BEFORE sending the request, so that if the server
    //    immediately sends a forwarded-tcpip channel, the handler can find it.
    forwarding_table.insert(remote_port, (local_host.clone(), local_port));

    // 3. Ask the server to start listening on the remote port.
    let actual_port = match remote::request_remote_forward(&ssh_handle, remote_port).await {
        Ok(port) => port,
        Err(e) => {
            // Clean up the table entry on failure.
            forwarding_table.remove(&remote_port);
            return Err(e);
        }
    };

    // If the server assigned a different port (e.g. we asked for 0), update the table.
    if actual_port != remote_port {
        forwarding_table.remove(&remote_port);
        forwarding_table.insert(actual_port, (local_host.clone(), local_port));
    }

    let tunnel_id = Uuid::new_v4().to_string();

    Ok(RemoteTunnelInfo {
        tunnel_id,
        session_id,
        remote_port: actual_port,
        local_host,
        local_port,
        active: true,
    })
}

/// Stop a remote (reverse) port forward.
///
/// Sends `cancel-tcpip-forward` to the server and removes the forwarding table entry.
#[tauri::command]
pub async fn tunnel_stop_remote(
    state: State<'_, AppState>,
    session_id: String,
    remote_port: u32,
) -> Result<(), SshError> {
    let ssh_handle = state.ssh_manager.get_ssh_handle(&session_id)?;
    let forwarding_table = state.ssh_manager.get_forwarding_table(&session_id)?;

    // Send cancel request to server.
    remote::cancel_remote_forward(&ssh_handle, remote_port).await?;

    // Remove from forwarding table.
    forwarding_table.remove(&remote_port);

    log::info!(
        "Remote forward stopped: session={}, remote_port={}",
        session_id,
        remote_port
    );

    Ok(())
}

/// List all active remote tunnels for a session.
#[tauri::command]
pub async fn tunnel_list_remote(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Vec<RemoteTunnelInfo>, SshError> {
    let forwarding_table = state.ssh_manager.get_forwarding_table(&session_id)?;

    let tunnels: Vec<RemoteTunnelInfo> = forwarding_table
        .iter()
        .map(|entry| {
            let rport = *entry.key();
            let (lhost, lport) = entry.value().clone();
            RemoteTunnelInfo {
                tunnel_id: Uuid::new_v4().to_string(),
                session_id: session_id.clone(),
                remote_port: rport,
                local_host: lhost,
                local_port: lport,
                active: true,
            }
        })
        .collect();

    Ok(tunnels)
}
