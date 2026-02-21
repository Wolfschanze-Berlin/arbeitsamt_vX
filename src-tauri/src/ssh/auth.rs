use std::path::PathBuf;
use std::sync::Arc;

use russh::client::{Handle, Handler};
use russh::keys::agent::client::AgentClient;
use russh::keys::{HashAlg, PrivateKeyWithHashAlg, PublicKey};

use crate::error::SshError;

/// Supported authentication methods
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(tag = "method")]
pub enum AuthMethod {
    #[serde(rename = "password")]
    Password { password: String },
    #[serde(rename = "keyfile")]
    KeyFile {
        key_path: String,
        passphrase: Option<String>,
    },
    #[serde(rename = "agent")]
    Agent,
}

/// Information about a key held by the SSH agent, suitable for display in the UI.
#[derive(Debug, Clone, serde::Serialize)]
pub struct AgentKeyInfo {
    /// Key algorithm (e.g. "ssh-ed25519", "ssh-rsa")
    pub key_type: String,
    /// SHA-256 fingerprint (e.g. "SHA256:...")
    pub fingerprint: String,
    /// Comment attached to the key (e.g. "user@host")
    pub comment: String,
}

/// Type alias for a dynamic (type-erased) agent client usable across platforms.
type DynAgentClient =
    AgentClient<Box<dyn russh::keys::agent::client::AgentStream + Send + Unpin + 'static>>;

/// Connect to the platform's SSH agent and return a type-erased client.
///
/// - **Unix**: reads `SSH_AUTH_SOCK` environment variable and connects to the Unix socket.
/// - **Windows**: connects to the OpenSSH named pipe `\\.\pipe\openssh-ssh-agent`.
async fn connect_agent() -> Result<DynAgentClient, SshError> {
    #[cfg(unix)]
    {
        AgentClient::connect_env()
            .await
            .map(|c| c.dynamic())
            .map_err(|e| SshError::AuthFailed(format!("Cannot connect to SSH agent: {e}")))
    }

    #[cfg(windows)]
    {
        AgentClient::connect_named_pipe(r"\\.\pipe\openssh-ssh-agent")
            .await
            .map(|c| c.dynamic())
            .map_err(|e| SshError::AuthFailed(format!("Cannot connect to SSH agent: {e}")))
    }
}

/// Check whether an SSH agent is available on this system.
///
/// Returns `true` if we can successfully connect; `false` otherwise.
pub async fn is_agent_available() -> bool {
    connect_agent().await.is_ok()
}

/// Retrieve all public keys currently held by the SSH agent.
async fn get_agent_keys(agent: &mut DynAgentClient) -> Result<Vec<PublicKey>, SshError> {
    agent
        .request_identities()
        .await
        .map_err(|e| SshError::AuthFailed(format!("Failed to list agent keys: {e}")))
}

/// List all keys in the SSH agent with human-readable metadata.
pub async fn list_agent_key_info() -> Result<Vec<AgentKeyInfo>, SshError> {
    let mut agent = connect_agent().await?;
    let keys = get_agent_keys(&mut agent).await?;

    Ok(keys
        .iter()
        .map(|k| AgentKeyInfo {
            key_type: k.algorithm().to_string(),
            fingerprint: k.fingerprint(HashAlg::Sha256).to_string(),
            comment: k.comment().to_string(),
        })
        .collect())
}

/// Authenticate with the SSH server using the given method.
/// Returns Ok(()) on success, Err(SshError::AuthFailed) on failure.
pub async fn authenticate<H: Handler>(
    session: &mut Handle<H>,
    username: &str,
    method: &AuthMethod,
) -> Result<(), SshError> {
    match method {
        AuthMethod::Password { password } => {
            let result = session
                .authenticate_password(username, password)
                .await
                .map_err(|e| SshError::AuthFailed(e.to_string()))?;
            if !result.success() {
                return Err(SshError::AuthFailed(
                    "Password authentication rejected".to_string(),
                ));
            }
            Ok(())
        }
        AuthMethod::KeyFile {
            key_path,
            passphrase,
        } => {
            let path = resolve_key_path(key_path);
            let key = russh::keys::load_secret_key(&path, passphrase.as_deref()).map_err(
                |e| SshError::AuthFailed(format!("Failed to load key {}: {}", path.display(), e)),
            )?;

            // For RSA keys we need to negotiate the best hash algorithm;
            // for other key types the hash_alg is ignored by PrivateKeyWithHashAlg.
            let hash_alg = session
                .best_supported_rsa_hash()
                .await
                .map_err(|e| SshError::AuthFailed(e.to_string()))?
                .flatten();

            let key_with_alg = PrivateKeyWithHashAlg::new(Arc::new(key), hash_alg);

            let result = session
                .authenticate_publickey(username, key_with_alg)
                .await
                .map_err(|e| SshError::AuthFailed(e.to_string()))?;
            if !result.success() {
                return Err(SshError::AuthFailed(
                    "Public key authentication rejected".to_string(),
                ));
            }
            Ok(())
        }
        AuthMethod::Agent => {
            // Agent authentication is handled by `authenticate_agent()`.
            // Call it separately from `ssh_connect` in commands/ssh.rs.
            // Reaching this branch means the caller forgot to check for Agent.
            Err(SshError::AuthFailed(
                "Agent auth must be dispatched via authenticate_agent()".to_string(),
            ))
        }
    }
}

/// Authenticate with the SSH server using the SSH agent.
///
/// This is exposed as a standalone public function (rather than handled inside
/// `authenticate`) because the combination of a generic `H: Handler` parameter
/// with the type-erased `DynAgentClient` across await points causes the Rust
/// compiler to fail proving that the resulting future is `Send`, which is
/// required by the `#[tauri::command]` macro.  Calling this directly from the
/// Tauri command handler with a concrete `Handle` type sidesteps the issue.
pub async fn authenticate_agent<H: Handler>(
    session: &mut Handle<H>,
    username: &str,
) -> Result<(), SshError> {
    let mut agent = connect_agent().await?;
    let keys = get_agent_keys(&mut agent).await?;

    if keys.is_empty() {
        return Err(SshError::AuthFailed(
            "No keys available in SSH agent".to_string(),
        ));
    }

    // Negotiate best RSA hash algorithm once (used for RSA keys only).
    let rsa_hash = session
        .best_supported_rsa_hash()
        .await
        .map_err(|e| SshError::AuthFailed(e.to_string()))?
        .flatten();

    for key in &keys {
        // For RSA keys use the negotiated hash; for others pass None.
        let hash_alg = if key.algorithm().to_string().contains("rsa") {
            rsa_hash
        } else {
            None
        };

        match session
            .authenticate_publickey_with(username, key.clone(), hash_alg, &mut agent)
            .await
        {
            Ok(result) if result.success() => return Ok(()),
            Ok(_) => continue,
            Err(_) => continue,
        }
    }

    Err(SshError::AuthFailed(
        "No agent key accepted by server".to_string(),
    ))
}

/// Resolve ~ and relative paths for SSH key files
fn resolve_key_path(path: &str) -> PathBuf {
    if path.starts_with("~/") || path.starts_with("~\\") {
        if let Some(home) = dirs::home_dir() {
            return home.join(&path[2..]);
        }
    }
    PathBuf::from(path)
}

/// Discover SSH keys in ~/.ssh/ directory
pub fn discover_keys() -> Vec<PathBuf> {
    let ssh_dir = match dirs::home_dir() {
        Some(home) => home.join(".ssh"),
        None => return vec![],
    };

    let key_names = ["id_ed25519", "id_ecdsa", "id_rsa", "id_dsa"];
    key_names
        .iter()
        .map(|name| ssh_dir.join(name))
        .filter(|path| path.exists())
        .collect()
}
