// PTY Tauri commands — local shell sessions

use tauri::{AppHandle, State};
use tauri::Manager;

use crate::error::SshError;
use crate::state::AppState;

/// Spawn a new local shell PTY session.
#[tauri::command]
pub async fn pty_spawn(
    app: AppHandle,
    pty_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), SshError> {
    let state = app.state::<AppState>();
    state.pty_manager.spawn_pty(app.clone(), pty_id, cols, rows)
}

/// Write raw bytes (user keystrokes) to a local PTY session.
#[tauri::command]
pub async fn pty_write(
    state: State<'_, AppState>,
    pty_id: String,
    data: Vec<u8>,
) -> Result<(), SshError> {
    state.pty_manager.write_pty(&pty_id, &data)
}

/// Resize a local PTY session.
#[tauri::command]
pub async fn pty_resize(
    state: State<'_, AppState>,
    pty_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), SshError> {
    state.pty_manager.resize_pty(&pty_id, cols, rows)
}

/// Close a local PTY session.
#[tauri::command]
pub async fn pty_close(
    state: State<'_, AppState>,
    pty_id: String,
) -> Result<(), SshError> {
    state.pty_manager.close_pty(&pty_id)
}
