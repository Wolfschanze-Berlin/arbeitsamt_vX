use serde::{Deserialize, Serialize};

/// A saved SSH connection profile.
/// Passwords are NOT stored — they are entered at connect time.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionProfile {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: ProfileAuthMethod,
    /// Optional color tag for environment indication (e.g., "red", "green", "blue")
    pub color_tag: Option<String>,
}

/// Authentication method stored in a profile.
/// Unlike `AuthMethod`, this never contains secrets.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "method")]
pub enum ProfileAuthMethod {
    /// Password auth — password entered at connect time, never persisted
    #[serde(rename = "password")]
    Password,
    /// Key file auth — only the path is stored, passphrase entered at connect time
    #[serde(rename = "keyfile")]
    KeyFile { key_path: String },
    /// SSH agent forwarding
    #[serde(rename = "agent")]
    Agent,
}
