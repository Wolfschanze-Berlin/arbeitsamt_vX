use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum CloudError {
    AuthFailed(String),
    NotFound(String),
    AwsApiError(String),
    StoreError(String),
    ConfigError(String),
}

impl std::fmt::Display for CloudError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::AuthFailed(msg) => write!(f, "Authentication failed: {msg}"),
            Self::NotFound(msg) => write!(f, "Not found: {msg}"),
            Self::AwsApiError(msg) => write!(f, "AWS API error: {msg}"),
            Self::StoreError(msg) => write!(f, "Store error: {msg}"),
            Self::ConfigError(msg) => write!(f, "Config error: {msg}"),
        }
    }
}

impl std::error::Error for CloudError {}
