// SFTP file operations — Wave 4

use russh_sftp::client::SftpSession;
use serde::Serialize;

use crate::error::SshError;

/// File/directory entry from an SFTP listing, serialized to the frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpEntry {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub permissions: Option<u32>,
    /// Unix timestamp (seconds since epoch)
    pub modified: Option<u64>,
}

/// List directory contents.
pub async fn list_dir(sftp: &SftpSession, path: &str) -> Result<Vec<SftpEntry>, SshError> {
    let entries = sftp
        .read_dir(path)
        .await
        .map_err(|e| SshError::SftpError(format!("Failed to list {}: {}", path, e)))?;

    let mut result = Vec::new();
    for entry in entries {
        let metadata = entry.metadata();
        result.push(SftpEntry {
            name: entry.file_name(),
            is_dir: metadata.is_dir(),
            size: metadata.size.unwrap_or(0),
            permissions: metadata.permissions,
            modified: metadata.mtime.map(|t| t as u64),
        });
    }
    Ok(result)
}

/// Create a directory.
pub async fn mkdir(sftp: &SftpSession, path: &str) -> Result<(), SshError> {
    sftp.create_dir(path)
        .await
        .map_err(|e| SshError::SftpError(format!("Failed to create dir {}: {}", path, e)))
}

/// Delete a file.
pub async fn remove_file(sftp: &SftpSession, path: &str) -> Result<(), SshError> {
    sftp.remove_file(path)
        .await
        .map_err(|e| SshError::SftpError(format!("Failed to delete {}: {}", path, e)))
}

/// Delete a directory.
pub async fn remove_dir(sftp: &SftpSession, path: &str) -> Result<(), SshError> {
    sftp.remove_dir(path)
        .await
        .map_err(|e| SshError::SftpError(format!("Failed to remove dir {}: {}", path, e)))
}

/// Rename/move a file or directory.
pub async fn rename(sftp: &SftpSession, old: &str, new: &str) -> Result<(), SshError> {
    sftp.rename(old, new)
        .await
        .map_err(|e| SshError::SftpError(format!("Failed to rename {} to {}: {}", old, new, e)))
}

/// Get file/directory metadata.
pub async fn stat(sftp: &SftpSession, path: &str) -> Result<SftpEntry, SshError> {
    let metadata = sftp
        .metadata(path)
        .await
        .map_err(|e| SshError::SftpError(format!("Failed to stat {}: {}", path, e)))?;

    // Extract the basename from the path for the name field
    let name = path
        .rsplit('/')
        .next()
        .unwrap_or(path)
        .to_string();

    Ok(SftpEntry {
        name,
        is_dir: metadata.is_dir(),
        size: metadata.size.unwrap_or(0),
        permissions: metadata.permissions,
        modified: metadata.mtime.map(|t| t as u64),
    })
}
