// SFTP Tauri commands — Wave 4

use std::path::Path;

use tauri::ipc::Channel;
use tauri::State;
use tokio_util::sync::CancellationToken;

use crate::error::SshError;
use crate::sftp::operations::{self, SftpEntry};
use crate::sftp::transfer::{self, TransferProgress};
use crate::state::AppState;

/// List directory contents over SFTP.
/// Opens an SFTP subsystem on demand if one is not already cached for this session.
#[tauri::command]
pub async fn sftp_list_dir(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<Vec<SftpEntry>, SshError> {
    let sftp = state.ssh_manager.get_sftp_session(&session_id).await?;
    operations::list_dir(&sftp, &path).await
}

/// Create a directory over SFTP.
#[tauri::command]
pub async fn sftp_mkdir(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<(), SshError> {
    let sftp = state.ssh_manager.get_sftp_session(&session_id).await?;
    operations::mkdir(&sftp, &path).await
}

/// Delete a file or directory over SFTP.
/// Tries file deletion first; if the path is a directory, removes the directory instead.
#[tauri::command]
pub async fn sftp_delete(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
    is_dir: bool,
) -> Result<(), SshError> {
    let sftp = state.ssh_manager.get_sftp_session(&session_id).await?;
    if is_dir {
        operations::remove_dir(&sftp, &path).await
    } else {
        operations::remove_file(&sftp, &path).await
    }
}

/// Rename/move a file or directory over SFTP.
#[tauri::command]
pub async fn sftp_rename(
    state: State<'_, AppState>,
    session_id: String,
    old_path: String,
    new_path: String,
) -> Result<(), SshError> {
    let sftp = state.ssh_manager.get_sftp_session(&session_id).await?;
    operations::rename(&sftp, &old_path, &new_path).await
}

/// Get file/directory metadata over SFTP.
#[tauri::command]
pub async fn sftp_stat(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<SftpEntry, SshError> {
    let sftp = state.ssh_manager.get_sftp_session(&session_id).await?;
    operations::stat(&sftp, &path).await
}

/// Upload a local file to the remote server over SFTP.
///
/// Returns a transfer ID that the frontend can use to correlate progress events
/// and cancel the transfer via `sftp_cancel_transfer`.
/// Progress updates are streamed via the `on_progress` channel.
#[tauri::command]
pub async fn sftp_upload(
    state: State<'_, AppState>,
    session_id: String,
    local_path: String,
    remote_path: String,
    on_progress: Channel<TransferProgress>,
) -> Result<String, SshError> {
    let sftp = state.ssh_manager.get_sftp_session(&session_id).await?;
    let transfer_id = uuid::Uuid::new_v4().to_string();
    let cancel = CancellationToken::new();

    // Store the cancel token so the frontend can cancel via sftp_cancel_transfer
    state
        .transfer_cancels
        .insert(transfer_id.clone(), cancel.clone());

    let result = transfer::upload_file(
        &sftp,
        Path::new(&local_path),
        &remote_path,
        transfer_id.clone(),
        on_progress,
        cancel,
    )
    .await;

    // Clean up the cancel token regardless of outcome
    state.transfer_cancels.remove(&transfer_id);

    result?;
    Ok(transfer_id)
}

/// Download a remote file to the local filesystem over SFTP.
///
/// Returns a transfer ID that the frontend can use to correlate progress events
/// and cancel the transfer via `sftp_cancel_transfer`.
/// Progress updates are streamed via the `on_progress` channel.
#[tauri::command]
pub async fn sftp_download(
    state: State<'_, AppState>,
    session_id: String,
    remote_path: String,
    local_path: String,
    on_progress: Channel<TransferProgress>,
) -> Result<String, SshError> {
    let sftp = state.ssh_manager.get_sftp_session(&session_id).await?;
    let transfer_id = uuid::Uuid::new_v4().to_string();
    let cancel = CancellationToken::new();

    // Store the cancel token so the frontend can cancel via sftp_cancel_transfer
    state
        .transfer_cancels
        .insert(transfer_id.clone(), cancel.clone());

    let local = std::path::PathBuf::from(&local_path);

    let result = transfer::download_file(
        &sftp,
        &remote_path,
        &local,
        transfer_id.clone(),
        on_progress,
        cancel,
    )
    .await;

    // Clean up the cancel token regardless of outcome
    state.transfer_cancels.remove(&transfer_id);

    result?;
    Ok(transfer_id)
}

/// Cancel an in-progress SFTP transfer (upload or download).
#[tauri::command]
pub async fn sftp_cancel_transfer(
    state: State<'_, AppState>,
    transfer_id: String,
) -> Result<(), SshError> {
    if let Some((_, token)) = state.transfer_cancels.remove(&transfer_id) {
        token.cancel();
        Ok(())
    } else {
        Err(SshError::SftpError(format!(
            "No active transfer with id: {}",
            transfer_id
        )))
    }
}
