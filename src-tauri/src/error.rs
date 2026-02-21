use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum SshError {
    AuthFailed(String),
    ConnectionRefused(String),
    #[allow(dead_code)]
    HostKeyMismatch(String),
    SessionNotFound(String),
    ChannelClosed(String),
    Timeout(String),
    IoError(String),
    SftpError(String),
    TunnelError(String),
    ConfigError(String),
}

impl std::fmt::Display for SshError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::AuthFailed(msg) => write!(f, "Authentication failed: {msg}"),
            Self::ConnectionRefused(msg) => write!(f, "Connection refused: {msg}"),
            Self::HostKeyMismatch(msg) => write!(f, "Host key mismatch: {msg}"),
            Self::SessionNotFound(msg) => write!(f, "Session not found: {msg}"),
            Self::ChannelClosed(msg) => write!(f, "Channel closed: {msg}"),
            Self::Timeout(msg) => write!(f, "Timeout: {msg}"),
            Self::IoError(msg) => write!(f, "I/O error: {msg}"),
            Self::SftpError(msg) => write!(f, "SFTP error: {msg}"),
            Self::TunnelError(msg) => write!(f, "Tunnel error: {msg}"),
            Self::ConfigError(msg) => write!(f, "Config error: {msg}"),
        }
    }
}

impl From<std::io::Error> for SshError {
    fn from(e: std::io::Error) -> Self {
        Self::IoError(e.to_string())
    }
}

impl From<russh::Error> for SshError {
    fn from(e: russh::Error) -> Self {
        Self::IoError(e.to_string())
    }
}

impl From<russh::keys::Error> for SshError {
    fn from(e: russh::keys::Error) -> Self {
        Self::AuthFailed(e.to_string())
    }
}
