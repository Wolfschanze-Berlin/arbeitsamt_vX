// SSH config parsing — Wave 5

use std::path::PathBuf;

use serde::Serialize;

use crate::error::SshError;

/// Resolved SSH config for a host alias, derived from ~/.ssh/config.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedSshConfig {
    pub hostname: String,
    pub port: u16,
    pub user: Option<String>,
    pub identity_file: Option<String>,
    pub proxy_jump: Option<String>,
}

/// Parse ~/.ssh/config and resolve settings for a given host alias.
///
/// Uses `russh_config` for Hostname, Port, and User resolution (it correctly
/// handles Host pattern matching, wildcard entries, negated patterns, and
/// directive merging per the OpenSSH spec). IdentityFile and ProxyJump are
/// extracted via a lightweight manual scan because `russh_config::Config`
/// does not expose those fields in its public API.
///
/// If no config file exists, returns sensible defaults (hostname = alias, port = 22).
pub fn resolve_host(host_alias: &str) -> Result<ResolvedSshConfig, SshError> {
    let config_path = get_ssh_config_path();

    if !config_path.exists() {
        return Ok(ResolvedSshConfig {
            hostname: host_alias.to_string(),
            port: 22,
            user: None,
            identity_file: None,
            proxy_jump: None,
        });
    }

    // Use russh_config for hostname, port, user (proper pattern matching)
    let config = russh_config::parse_path(&config_path, host_alias).map_err(|e| {
        SshError::ConfigError(format!("Failed to parse SSH config for '{}': {}", host_alias, e))
    })?;

    // Supplement with manual parsing for fields not exposed by russh_config's public API
    let contents = std::fs::read_to_string(&config_path)
        .map_err(|e| SshError::ConfigError(format!("Failed to read SSH config: {}", e)))?;
    let extra = parse_extra_directives(host_alias, &contents);

    Ok(ResolvedSshConfig {
        hostname: config.host().to_string(),
        port: config.port(),
        user: Some(config.user()),
        identity_file: extra.identity_file,
        proxy_jump: extra.proxy_jump,
    })
}

/// Extra directives not exposed by russh_config's public API.
struct ExtraDirectives {
    identity_file: Option<String>,
    proxy_jump: Option<String>,
}

/// Simple first-match parser for IdentityFile and ProxyJump.
///
/// Scans the config for Host blocks that match `host_alias` (exact match only,
/// plus the wildcard `*` block) and collects the first IdentityFile and ProxyJump
/// values found. This mirrors the "first match wins" semantics of OpenSSH.
fn parse_extra_directives(host_alias: &str, contents: &str) -> ExtraDirectives {
    let mut identity_file: Option<String> = None;
    let mut proxy_jump: Option<String> = None;
    let mut in_matching_block = false;

    for line in contents.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let tokens: Vec<&str> = trimmed.splitn(2, ' ').collect();
        if tokens.len() < 2 {
            continue;
        }

        let key = tokens[0].to_lowercase();
        let value = tokens[1].trim();

        if key == "host" {
            // Check if any pattern in this Host line matches our alias
            in_matching_block = value.split_ascii_whitespace().any(|pattern| {
                if pattern.starts_with('!') {
                    return false;
                }
                pattern == "*" || pattern == host_alias
            });
            continue;
        }

        if !in_matching_block {
            continue;
        }

        match key.as_str() {
            "identityfile" if identity_file.is_none() => {
                let path = value.trim_matches(|c| c == '\'' || c == '"');
                // Expand ~ to home directory
                let expanded = if path.starts_with("~/") {
                    if let Some(home) = dirs::home_dir() {
                        home.join(&path[2..]).to_string_lossy().to_string()
                    } else {
                        path.to_string()
                    }
                } else {
                    path.to_string()
                };
                identity_file = Some(expanded);
            }
            "proxyjump" if proxy_jump.is_none() => {
                proxy_jump = Some(value.to_string());
            }
            _ => {}
        }
    }

    ExtraDirectives {
        identity_file,
        proxy_jump,
    }
}

/// Get list of all host aliases defined in ~/.ssh/config.
///
/// Filters out wildcard patterns (containing * or ?) since those are not
/// concrete host aliases a user would select. The russh_config crate does not
/// expose its parsed host entries, so we do a lightweight manual scan of the
/// file for `Host` directives.
pub fn list_hosts() -> Vec<String> {
    let config_path = get_ssh_config_path();
    if !config_path.exists() {
        return vec![];
    }

    let contents = match std::fs::read_to_string(&config_path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };

    parse_host_aliases(&contents)
}

fn get_ssh_config_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_default()
        .join(".ssh")
        .join("config")
}

/// Extract concrete (non-wildcard) host aliases from raw SSH config text.
fn parse_host_aliases(contents: &str) -> Vec<String> {
    let mut hosts = Vec::new();

    for line in contents.lines() {
        let trimmed = line.trim();
        // Skip comments and empty lines
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let tokens: Vec<&str> = trimmed.splitn(2, ' ').collect();
        if tokens.len() == 2 && tokens[0].eq_ignore_ascii_case("host") {
            for pattern in tokens[1].split_ascii_whitespace() {
                // Skip wildcard patterns and negated patterns
                if pattern.contains('*') || pattern.contains('?') || pattern.starts_with('!') {
                    continue;
                }
                if !pattern.is_empty() {
                    hosts.push(pattern.to_string());
                }
            }
        }
    }

    hosts
}
