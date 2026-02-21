// SSH Tauri commands — Wave 3

use std::sync::Arc;
use std::time::Duration;

use serde_json::json;
use tauri::ipc::Channel;
use tauri::{AppHandle, State};
use tauri_plugin_store::StoreExt;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use tauri::Manager;

use crate::error::SshError;
use crate::ssh::auth::{authenticate, authenticate_agent, authenticate_auto, is_agent_available, list_agent_key_info, AgentKeyInfo, AuthMethod};
use crate::ssh::config::ResolvedSshConfig;
use crate::ssh::handler::{ClientHandler, ForwardingTable};
use crate::ssh::keepalive;
use crate::ssh::manager::{ConnectionInfo, SshManager, TerminalCommand};
use crate::ssh::profiles::ConnectionProfile;
use crate::ssh::terminal::TerminalActor;
use crate::state::AppState;

const PROFILES_STORE: &str = "ssh-profiles.json";
const PROFILES_KEY: &str = "ssh_profiles";

/// Wrapper that makes a `!Send` future usable in contexts requiring `Send`.
///
/// # Safety
/// The caller must ensure the future is only polled from a single thread, which
/// is the case when executed within a single `tokio::spawn` task (Tokio
/// guarantees a task runs on one thread at a time between yield points).
struct AssertSend<F>(F);

unsafe impl<F: std::future::Future> Send for AssertSend<F> {}

impl<F: std::future::Future> std::future::Future for AssertSend<F> {
    type Output = F::Output;

    fn poll(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Self::Output> {
        // SAFETY: we never move the inner future after pinning.
        let inner = unsafe { self.map_unchecked_mut(|s| &mut s.0) };
        inner.poll(cx)
    }
}

/// Stateless TCP reachability check — no SSH auth, no session state.
/// Returns `true` if a TCP handshake to `host:port` succeeds within 3 seconds.
#[tauri::command]
pub async fn ssh_ping_host(host: String, port: u16) -> Result<bool, SshError> {
    let addr = format!("{}:{}", host, port);
    match tokio::time::timeout(
        Duration::from_secs(3),
        tokio::net::TcpStream::connect(&addr),
    )
    .await
    {
        Ok(Ok(_)) => Ok(true),
        _ => Ok(false),
    }
}

/// Connect to an SSH server and return the session ID.
/// The `output` channel streams terminal data (raw bytes) to the frontend.
///
/// Uses `AssertSend` to work around a Rust compiler limitation where inherent
/// async methods on `russh::Channel` / `russh::ChannelWriteHalf` produce
/// futures whose `Send` bound cannot be proven for higher-ranked lifetimes
/// (the `&self` borrow across `.await` triggers the issue).  All types
/// involved ARE in fact `Send`+`Sync`; only the compiler's RPITIT analysis
/// fails to prove it.
#[tauri::command]
pub async fn ssh_connect(
    app: AppHandle,
    host: String,
    port: u16,
    username: String,
    auth_method: AuthMethod,
    cols: u16,
    rows: u16,
    output: Channel<Vec<u8>>,
) -> Result<String, SshError> {
    AssertSend(async move {
        let session_id = SshManager::generate_session_id();

        // 1. Create russh client config with keepalive and inactivity timeout.
        let mut config = russh::client::Config::default();
        config.inactivity_timeout = Some(Duration::from_secs(60));
        config.keepalive_interval = keepalive::keepalive_interval(
            keepalive::DEFAULT_KEEPALIVE_INTERVAL_SECS,
        );
        config.keepalive_max = keepalive::DEFAULT_KEEPALIVE_MAX;
        let config = Arc::new(config);

        // 2. TCP connect + SSH handshake
        let forwarding_table: ForwardingTable = std::sync::Arc::new(dashmap::DashMap::new());
        let handler = ClientHandler::with_forwarding_table(forwarding_table.clone());
        let mut handle = tokio::time::timeout(
            Duration::from_secs(15),
            russh::client::connect(config, (host.as_str(), port), handler),
        )
        .await
        .map_err(|_| SshError::Timeout(format!("Connection to {}:{} timed out", host, port)))?
        .map_err(|e| SshError::ConnectionRefused(format!("{}:{}: {}", host, port, e)))?;

        // 3. Authenticate with the provided method.
        match &auth_method {
            AuthMethod::Agent => authenticate_agent(&mut handle, &username).await?,
            AuthMethod::Auto { identity_file } => {
                authenticate_auto(&mut handle, &username, identity_file.as_deref()).await?
            }
            other => authenticate(&mut handle, &username, other).await?,
        }

        // 4. Open a session channel, then split for TerminalActor.
        let channel = handle
            .channel_open_session()
            .await
            .map_err(|e| {
                SshError::ChannelClosed(format!("Failed to open session channel: {}", e))
            })?;
        let (read_half, write_half) = channel.split();

        // 5. Request PTY (xterm-256color, given dimensions)
        write_half
            .request_pty(false, "xterm-256color", cols as u32, rows as u32, 0, 0, &[])
            .await
            .map_err(|e| SshError::ChannelClosed(format!("Failed to request PTY: {}", e)))?;

        // 6. Request shell
        write_half
            .request_shell(false)
            .await
            .map_err(|e| SshError::ChannelClosed(format!("Failed to request shell: {}", e)))?;

        // 7. Create command channel for TerminalActor
        let (cmd_tx, cmd_rx) = mpsc::unbounded_channel::<TerminalCommand>();

        // 8. Create cancellation token
        let cancel = CancellationToken::new();

        // 9. Spawn the TerminalActor I/O loop with dead-connection cleanup.
        let actor = TerminalActor::new(
            read_half, write_half, cmd_rx, output, session_id.clone(), cancel.clone(),
        );
        let cleanup_session_id = session_id.clone();
        let cleanup_app = app.clone();
        tokio::spawn(async move {
            actor.run().await;

            let cleanup_state = cleanup_app.state::<AppState>();
            if cleanup_state.ssh_manager.remove_session(&cleanup_session_id) {
                log::info!(
                    "Cleaned up dead session {} after TerminalActor exit",
                    cleanup_session_id
                );
            }
        });

        // 10. Register the session in the manager (passing the handle for SFTP reuse)
        let info = ConnectionInfo {
            session_id: session_id.clone(),
            host,
            port,
            username,
        };
        app.state::<AppState>()
            .ssh_manager
            .register_session(info, cmd_tx, cancel, handle, forwarding_table);

        Ok(session_id)
    })
    .await
}

/// Send raw bytes (keystrokes) to an SSH session.
#[tauri::command]
pub async fn ssh_write(
    state: State<'_, AppState>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), SshError> {
    state.ssh_manager.send_data(&session_id, data)
}

/// Resize the terminal PTY.
#[tauri::command]
pub async fn ssh_resize(
    state: State<'_, AppState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), SshError> {
    state.ssh_manager.resize(&session_id, cols, rows)
}

/// Replace the output channel for a running SSH session.
/// Called by a pop-out window to redirect terminal data to itself.
#[tauri::command]
pub async fn ssh_reattach_output(
    state: State<'_, AppState>,
    session_id: String,
    output: Channel<Vec<u8>>,
) -> Result<(), SshError> {
    state.ssh_manager.reattach_output(&session_id, output)
}

/// Disconnect an SSH session.
#[tauri::command]
pub async fn ssh_disconnect(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), SshError> {
    state.ssh_manager.disconnect(&session_id)
}

/// List all active SSH sessions.
#[tauri::command]
pub async fn ssh_list_sessions(
    state: State<'_, AppState>,
) -> Result<Vec<ConnectionInfo>, SshError> {
    Ok(state.ssh_manager.list_sessions())
}

// ---------------------------------------------------------------------------
// Connection profile CRUD commands
// ---------------------------------------------------------------------------

/// Helper: load all profiles from the store.
fn load_profiles(app: &AppHandle) -> Result<Vec<ConnectionProfile>, SshError> {
    let store = app
        .store(PROFILES_STORE)
        .map_err(|e| SshError::ConfigError(format!("Failed to open profile store: {e}")))?;

    match store.get(PROFILES_KEY) {
        Some(value) => serde_json::from_value(value)
            .map_err(|e| SshError::ConfigError(format!("Failed to parse profiles: {e}"))),
        None => Ok(Vec::new()),
    }
}

/// Helper: persist the full profile list to the store.
fn save_profiles(app: &AppHandle, profiles: &[ConnectionProfile]) -> Result<(), SshError> {
    let store = app
        .store(PROFILES_STORE)
        .map_err(|e| SshError::ConfigError(format!("Failed to open profile store: {e}")))?;

    store.set(
        PROFILES_KEY.to_string(),
        json!(profiles),
    );

    store
        .save()
        .map_err(|e| SshError::ConfigError(format!("Failed to save profile store: {e}")))?;

    Ok(())
}

/// Save a new connection profile (or overwrite one with the same id).
#[tauri::command]
pub async fn ssh_save_profile(
    app: AppHandle,
    profile: ConnectionProfile,
) -> Result<(), SshError> {
    let mut profiles = load_profiles(&app)?;

    // Replace if a profile with same id already exists, otherwise append
    if let Some(existing) = profiles.iter_mut().find(|p| p.id == profile.id) {
        *existing = profile;
    } else {
        profiles.push(profile);
    }

    save_profiles(&app, &profiles)
}

/// List all saved connection profiles.
#[tauri::command]
pub async fn ssh_list_profiles(app: AppHandle) -> Result<Vec<ConnectionProfile>, SshError> {
    load_profiles(&app)
}

/// Delete a connection profile by id.
#[tauri::command]
pub async fn ssh_delete_profile(
    app: AppHandle,
    profile_id: String,
) -> Result<(), SshError> {
    let mut profiles = load_profiles(&app)?;
    let original_len = profiles.len();
    profiles.retain(|p| p.id != profile_id);

    if profiles.len() == original_len {
        return Err(SshError::ConfigError(format!(
            "Profile not found: {profile_id}"
        )));
    }

    save_profiles(&app, &profiles)
}

/// Update an existing connection profile. Fails if the profile id does not exist.
#[tauri::command]
pub async fn ssh_update_profile(
    app: AppHandle,
    profile: ConnectionProfile,
) -> Result<(), SshError> {
    let mut profiles = load_profiles(&app)?;

    let existing = profiles
        .iter_mut()
        .find(|p| p.id == profile.id)
        .ok_or_else(|| {
            SshError::ConfigError(format!("Profile not found: {}", profile.id))
        })?;

    *existing = profile;
    save_profiles(&app, &profiles)
}

// ---------------------------------------------------------------------------
// SSH config parsing commands
// ---------------------------------------------------------------------------

/// Resolve SSH config for a host alias by parsing ~/.ssh/config.
#[tauri::command]
pub async fn ssh_resolve_config(host: String) -> Result<ResolvedSshConfig, SshError> {
    crate::ssh::config::resolve_host(&host)
}

/// List all concrete host aliases defined in ~/.ssh/config.
#[tauri::command]
pub async fn ssh_list_config_hosts() -> Result<Vec<String>, SshError> {
    Ok(crate::ssh::config::list_hosts())
}

// ---------------------------------------------------------------------------
// SSH agent commands
// ---------------------------------------------------------------------------

/// Discover default SSH private keys in ~/.ssh/ (e.g. id_ed25519, id_rsa).
#[tauri::command]
pub async fn ssh_discover_keys() -> Result<Vec<String>, SshError> {
    Ok(crate::ssh::auth::discover_keys()
        .into_iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect())
}

/// Check whether an SSH agent is reachable on this system.
#[tauri::command]
pub async fn ssh_check_agent() -> Result<bool, SshError> {
    Ok(is_agent_available().await)
}

/// List all keys currently held by the SSH agent.
#[tauri::command]
pub async fn ssh_list_agent_keys() -> Result<Vec<AgentKeyInfo>, SshError> {
    list_agent_key_info().await
}

// ---------------------------------------------------------------------------
// Exec channel command (non-interactive, one-shot)
// ---------------------------------------------------------------------------

/// Execute a command on an existing SSH session via a new exec channel.
/// Opens a dedicated session channel (separate from the PTY shell), runs the
/// command, collects stdout, and returns it. Stderr is reported in the error
/// if the command exits with a non-zero code.
#[tauri::command]
pub async fn ssh_exec(
    state: State<'_, AppState>,
    session_id: String,
    command: String,
) -> Result<String, SshError> {
    AssertSend(async move {
        // 1. Get handle
        let ssh_handle = state.ssh_manager.get_ssh_handle(&session_id)?;
        let handle = ssh_handle.lock().await;

        // 2. Open a new session channel for exec
        let mut channel = handle
            .channel_open_session()
            .await
            .map_err(|e| SshError::ChannelClosed(format!("Failed to open exec channel: {}", e)))?;

        // 3. Execute command
        channel
            .exec(true, command.as_bytes())
            .await
            .map_err(|e| SshError::ChannelClosed(format!("exec failed: {}", e)))?;

        // IMPORTANT: Drop the handle lock before reading output to avoid deadlocks.
        drop(handle);

        // 4. Read output with 30s timeout
        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        let mut exit_code: Option<u32> = None;

        let result = tokio::time::timeout(Duration::from_secs(30), async {
            loop {
                match channel.wait().await {
                    Some(russh::ChannelMsg::Data { data }) => {
                        stdout.extend_from_slice(&data);
                    }
                    Some(russh::ChannelMsg::ExtendedData { data, ext }) if ext == 1 => {
                        stderr.extend_from_slice(&data);
                    }
                    Some(russh::ChannelMsg::ExitStatus { exit_status }) => {
                        exit_code = Some(exit_status);
                    }
                    None => break,
                    _ => {}
                }
            }
        })
        .await;

        if result.is_err() {
            return Err(SshError::Timeout(
                "Command timed out after 30 seconds".into(),
            ));
        }

        // 5. Check exit code — return stderr in error for non-zero exits
        let output = String::from_utf8_lossy(&stdout).into_owned();
        if let Some(code) = exit_code {
            if code != 0 {
                let err_msg = String::from_utf8_lossy(&stderr);
                return Err(SshError::IoError(format!(
                    "Command exited with code {}: {}",
                    code, err_msg
                )));
            }
        }

        Ok(output)
    })
    .await
}
