use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CloudProviderKind {
    Aws,
}

/// How the account authenticates — profile reference or manual keys.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AuthMode {
    Profile,
    Manual,
}

impl Default for AuthMode {
    fn default() -> Self {
        Self::Profile
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudAccount {
    pub id: String,
    pub provider: CloudProviderKind,
    pub profile_name: String,
    pub display_name: String,
    pub region: String,
    pub account_id: String,
    /// How this account authenticates (default: Profile for backward compat)
    #[serde(default)]
    pub auth_mode: AuthMode,
    /// AWS access key ID — only set for Manual accounts
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub access_key_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CloudResource {
    pub instance_id: String,
    pub name: String,
    pub instance_type: String,
    pub state: String,
    pub public_ip: Option<String>,
    pub private_ip: Option<String>,
    pub launch_time: Option<String>,
    pub tags: Vec<ResourceTag>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResourceTag {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InstanceAction {
    Start,
    Stop,
    Reboot,
    Terminate,
}
