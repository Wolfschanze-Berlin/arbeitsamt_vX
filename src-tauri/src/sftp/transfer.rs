// SFTP file transfer — Wave 4

use std::path::Path;

use russh_sftp::client::SftpSession;
use serde::Serialize;
use tauri::ipc::Channel;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio_util::sync::CancellationToken;

use crate::error::SshError;

/// Progress update sent to the frontend via a Tauri IPC channel.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferProgress {
    pub transfer_id: String,
    pub bytes_transferred: u64,
    pub total_bytes: u64,
    pub percentage: f64,
    pub done: bool,
    pub cancelled: bool,
}

/// Upload a local file to the remote server via SFTP with progress reporting.
///
/// Reads the local file in 64 KB chunks, writes each chunk to the remote file
/// through the SFTP session, and sends progress updates over the Tauri channel.
/// The `cancel` token allows the frontend to abort the transfer mid-flight.
pub async fn upload_file(
    sftp: &SftpSession,
    local_path: &Path,
    remote_path: &str,
    transfer_id: String,
    progress: Channel<TransferProgress>,
    cancel: CancellationToken,
) -> Result<(), SshError> {
    // 1. Read local file metadata for total size
    let metadata = tokio::fs::metadata(local_path)
        .await
        .map_err(|e| SshError::SftpError(format!("Cannot read local file: {}", e)))?;
    let total_bytes = metadata.len();

    // 2. Open local file for reading
    let mut local_file = tokio::fs::File::open(local_path)
        .await
        .map_err(|e| SshError::SftpError(format!("Cannot open local file: {}", e)))?;

    // 3. Create remote file for writing (creates + truncates if exists)
    let mut remote_file = sftp
        .create(remote_path)
        .await
        .map_err(|e| SshError::SftpError(format!("Cannot create remote file: {}", e)))?;

    // 4. Transfer in 64 KB chunks with progress reporting
    const CHUNK_SIZE: usize = 64 * 1024;
    let mut buffer = vec![0u8; CHUNK_SIZE];
    let mut bytes_transferred: u64 = 0;

    loop {
        // Check for cancellation before each chunk
        if cancel.is_cancelled() {
            // Attempt to close the remote handle before returning
            let _ = remote_file.shutdown().await;
            return Err(SshError::SftpError("Transfer cancelled".to_string()));
        }

        let n = local_file
            .read(&mut buffer)
            .await
            .map_err(|e| SshError::SftpError(format!("Local read error: {}", e)))?;

        if n == 0 {
            break;
        }

        // Write chunk to remote file via AsyncWrite
        remote_file
            .write_all(&buffer[..n])
            .await
            .map_err(|e| SshError::SftpError(format!("Remote write error: {}", e)))?;

        bytes_transferred += n as u64;
        let percentage = if total_bytes > 0 {
            (bytes_transferred as f64 / total_bytes as f64) * 100.0
        } else {
            100.0
        };

        // Send progress update (best-effort; ignore send failures)
        let _ = progress.send(TransferProgress {
            transfer_id: transfer_id.clone(),
            bytes_transferred,
            total_bytes,
            percentage,
            done: false,
            cancelled: false,
        });
    }

    // 5. Properly close the remote file handle
    remote_file
        .shutdown()
        .await
        .map_err(|e| SshError::SftpError(format!("Failed to close remote file: {}", e)))?;

    // 6. Send final 100% progress event
    let _ = progress.send(TransferProgress {
        transfer_id: transfer_id.clone(),
        bytes_transferred: total_bytes,
        total_bytes,
        percentage: 100.0,
        done: true,
        cancelled: false,
    });

    Ok(())
}

/// Download a remote file to the local filesystem via SFTP with progress reporting.
///
/// Gets the remote file size via `sftp.metadata()`, opens the remote file for reading,
/// creates the local file, reads in 64 KB chunks writing to the local file, and sends
/// progress updates over the Tauri channel. The `cancel` token allows the frontend to
/// abort the transfer mid-flight.
pub async fn download_file(
    sftp: &SftpSession,
    remote_path: &str,
    local_path: &Path,
    transfer_id: String,
    progress: Channel<TransferProgress>,
    cancel: CancellationToken,
) -> Result<(), SshError> {
    // 1. Get remote file size via metadata
    let metadata = sftp
        .metadata(remote_path)
        .await
        .map_err(|e| SshError::SftpError(format!("Failed to stat {}: {}", remote_path, e)))?;
    let total_bytes = metadata.size.unwrap_or(0);

    // 2. Open remote file for reading
    let mut remote_file = sftp
        .open(remote_path)
        .await
        .map_err(|e| SshError::SftpError(format!("Failed to open {}: {}", remote_path, e)))?;

    // 3. Create local file (ensure parent directory exists)
    if let Some(parent) = local_path.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| {
            SshError::IoError(format!(
                "Failed to create parent dirs for {}: {}",
                local_path.display(),
                e
            ))
        })?;
    }
    let mut local_file = tokio::fs::File::create(local_path).await.map_err(|e| {
        SshError::IoError(format!(
            "Failed to create local file {}: {}",
            local_path.display(),
            e
        ))
    })?;

    // 4. Transfer in 64 KB chunks with progress reporting
    const CHUNK_SIZE: usize = 64 * 1024;
    let mut buffer = vec![0u8; CHUNK_SIZE];
    let mut bytes_transferred: u64 = 0;

    loop {
        // 5. Check for cancellation before each chunk
        if cancel.is_cancelled() {
            // Send cancellation event to the frontend
            let _ = progress.send(TransferProgress {
                transfer_id: transfer_id.clone(),
                bytes_transferred,
                total_bytes,
                percentage: if total_bytes > 0 {
                    (bytes_transferred as f64 / total_bytes as f64) * 100.0
                } else {
                    0.0
                },
                done: false,
                cancelled: true,
            });
            // Clean up the partial local file
            let _ = tokio::fs::remove_file(local_path).await;
            return Err(SshError::SftpError("Transfer cancelled".to_string()));
        }

        let n = remote_file
            .read(&mut buffer)
            .await
            .map_err(|e| SshError::SftpError(format!("Remote read error: {}", e)))?;

        if n == 0 {
            break; // EOF
        }

        // Write chunk to local file
        local_file
            .write_all(&buffer[..n])
            .await
            .map_err(|e| SshError::IoError(format!("Local write error: {}", e)))?;

        bytes_transferred += n as u64;
        let percentage = if total_bytes > 0 {
            (bytes_transferred as f64 / total_bytes as f64) * 100.0
        } else {
            100.0
        };

        // Send progress update (best-effort; ignore send failures)
        let _ = progress.send(TransferProgress {
            transfer_id: transfer_id.clone(),
            bytes_transferred,
            total_bytes,
            percentage,
            done: false,
            cancelled: false,
        });
    }

    // 6. Flush local file to ensure all data is written
    local_file
        .flush()
        .await
        .map_err(|e| SshError::IoError(format!("Failed to flush {}: {}", local_path.display(), e)))?;

    // 7. Send final 100% progress event
    let _ = progress.send(TransferProgress {
        transfer_id: transfer_id.clone(),
        bytes_transferred,
        total_bytes,
        percentage: 100.0,
        done: true,
        cancelled: false,
    });

    Ok(())
}
