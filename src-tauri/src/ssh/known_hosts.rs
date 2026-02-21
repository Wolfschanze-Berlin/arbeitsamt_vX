// Known hosts TOFU verification — Wave 3

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use crate::error::SshError;

#[derive(Debug, Clone, PartialEq)]
pub enum HostKeyStatus {
    /// Host key matches known entry
    Known,
    /// Host not in known_hosts — first connection (TOFU prompt needed)
    Unknown,
    /// Host key CHANGED from known entry — possible MITM attack
    Changed { expected: String, actual: String },
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct HostKeyInfo {
    pub host: String,
    pub port: u16,
    pub key_type: String,
    pub fingerprint: String,
}

/// Simple known hosts store
pub struct KnownHostsStore {
    /// Map of "host:port" -> (key_type, base64_key)
    entries: HashMap<String, Vec<(String, String)>>,
    /// Path to app-local known_hosts file
    store_path: PathBuf,
}

impl KnownHostsStore {
    /// Load known hosts from ~/.ssh/known_hosts and app-local store
    pub fn load(app_data_dir: &PathBuf) -> Self {
        let mut entries = HashMap::new();
        let store_path = app_data_dir.join("known_hosts");

        // Load system known_hosts
        if let Some(home) = dirs::home_dir() {
            let system_path = home.join(".ssh").join("known_hosts");
            if let Ok(content) = fs::read_to_string(&system_path) {
                parse_known_hosts(&content, &mut entries);
            }
        }

        // Load app-local known_hosts
        if let Ok(content) = fs::read_to_string(&store_path) {
            parse_known_hosts(&content, &mut entries);
        }

        Self {
            entries,
            store_path,
        }
    }

    /// Check if a host key is known, unknown, or changed
    pub fn check(&self, host: &str, port: u16, key_type: &str, key_base64: &str) -> HostKeyStatus {
        let host_key = format_host_key(host, port);

        if let Some(keys) = self.entries.get(&host_key) {
            for (kt, kb64) in keys {
                if kt == key_type {
                    if kb64 == key_base64 {
                        return HostKeyStatus::Known;
                    } else {
                        return HostKeyStatus::Changed {
                            expected: kb64.clone(),
                            actual: key_base64.to_string(),
                        };
                    }
                }
            }
        }

        HostKeyStatus::Unknown
    }

    /// Save an accepted host key to the app-local store
    pub fn accept_key(
        &mut self,
        host: &str,
        port: u16,
        key_type: &str,
        key_base64: &str,
    ) -> Result<(), SshError> {
        let host_key = format_host_key(host, port);
        let line = if port == 22 {
            format!("{} {} {}\n", host, key_type, key_base64)
        } else {
            format!("[{}]:{} {} {}\n", host, port, key_type, key_base64)
        };

        // Ensure parent directory exists
        if let Some(parent) = self.store_path.parent() {
            fs::create_dir_all(parent).map_err(|e| SshError::IoError(e.to_string()))?;
        }

        // Append to file
        use std::io::Write;
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.store_path)
            .map_err(|e| SshError::IoError(e.to_string()))?;
        file.write_all(line.as_bytes())
            .map_err(|e| SshError::IoError(e.to_string()))?;

        // Update in-memory cache
        self.entries
            .entry(host_key)
            .or_default()
            .push((key_type.to_string(), key_base64.to_string()));

        Ok(())
    }
}

fn format_host_key(host: &str, port: u16) -> String {
    if port == 22 {
        host.to_string()
    } else {
        format!("[{}]:{}", host, port)
    }
}

/// Parse OpenSSH known_hosts format
fn parse_known_hosts(content: &str, entries: &mut HashMap<String, Vec<(String, String)>>) {
    for line in content.lines() {
        let line = line.trim();
        // Skip comments and empty lines
        if line.is_empty() || line.starts_with('#') || line.starts_with('@') {
            continue;
        }

        let parts: Vec<&str> = line.splitn(3, ' ').collect();
        if parts.len() < 3 {
            continue;
        }

        let host_part = parts[0];
        let key_type = parts[1];
        let key_base64 = parts[2].split_whitespace().next().unwrap_or("");

        // Handle multiple hosts separated by commas
        for host in host_part.split(',') {
            let host = host.trim();
            // Skip hashed entries (|1|...) for now — we can't match them without the salt
            if host.starts_with('|') {
                continue;
            }
            entries
                .entry(host.to_string())
                .or_default()
                .push((key_type.to_string(), key_base64.to_string()));
        }
    }
}
