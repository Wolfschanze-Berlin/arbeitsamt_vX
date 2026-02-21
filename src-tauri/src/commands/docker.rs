// Docker Tauri commands — container data + logs over SSH exec channels

use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::SshError;
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Serialize, Clone)]
pub struct DockerInfo {
    pub version: String,
    pub containers_running: u32,
    pub containers_stopped: u32,
    pub containers_paused: u32,
    pub images: u32,
}

#[derive(Serialize, Clone)]
pub struct ContainerInfo {
    pub id: String,
    pub name: String,
    pub image: String,
    pub state: String,
    pub status: String,
    pub ports: Vec<String>,
}

#[derive(Serialize, Clone)]
pub struct ContainerStats {
    pub name: String,
    pub cpu_pct: f32,
    pub mem_usage_mb: f32,
    pub mem_pct: f32,
    pub net_rx_mb: f32,
    pub net_tx_mb: f32,
    pub block_read_mb: f32,
    pub block_write_mb: f32,
    pub pids: u32,
}

#[derive(Serialize, Clone)]
pub struct DockerData {
    pub info: DockerInfo,
    pub containers: Vec<ContainerInfo>,
    pub stats: Vec<ContainerStats>,
}

// ---------------------------------------------------------------------------
// AssertSend wrapper (required for russh channel futures)
// ---------------------------------------------------------------------------

struct AssertSend<F>(F);

unsafe impl<F: std::future::Future> Send for AssertSend<F> {}

impl<F: std::future::Future> std::future::Future for AssertSend<F> {
    type Output = F::Output;

    fn poll(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Self::Output> {
        let inner = unsafe { self.map_unchecked_mut(|s| &mut s.0) };
        inner.poll(cx)
    }
}

// ---------------------------------------------------------------------------
// Helpers — exec a command over SSH and collect output
// ---------------------------------------------------------------------------

async fn ssh_exec_raw(
    state: &AppState,
    session_id: &str,
    command: &str,
    timeout_secs: u64,
) -> Result<(String, String), SshError> {
    let ssh_handle = state.ssh_manager.get_ssh_handle(session_id)?;
    let handle = ssh_handle.lock().await;

    let mut channel = handle
        .channel_open_session()
        .await
        .map_err(|e| SshError::ChannelClosed(format!("Failed to open exec channel: {}", e)))?;

    channel
        .exec(true, command.as_bytes())
        .await
        .map_err(|e| SshError::ChannelClosed(format!("exec failed: {}", e)))?;

    // Drop the lock before reading to avoid deadlocks.
    drop(handle);

    let mut stdout = Vec::new();
    let mut stderr = Vec::new();

    let result = tokio::time::timeout(Duration::from_secs(timeout_secs), async {
        loop {
            match channel.wait().await {
                Some(russh::ChannelMsg::Data { data }) => {
                    stdout.extend_from_slice(&data);
                }
                Some(russh::ChannelMsg::ExtendedData { data, ext }) if ext == 1 => {
                    stderr.extend_from_slice(&data);
                }
                Some(russh::ChannelMsg::ExitStatus { .. }) => {}
                None => break,
                _ => {}
            }
        }
    })
    .await;

    if result.is_err() {
        return Err(SshError::Timeout(format!(
            "Command timed out after {} seconds",
            timeout_secs
        )));
    }

    let out = String::from_utf8_lossy(&stdout).into_owned();
    let err = String::from_utf8_lossy(&stderr).into_owned();
    Ok((out, err))
}

// ---------------------------------------------------------------------------
// Docker error detection
// ---------------------------------------------------------------------------

fn check_docker_errors(output: &str) -> Result<(), SshError> {
    let lower = output.to_lowercase();
    if lower.contains("command not found") || lower.contains("is not recognized") {
        return Err(SshError::IoError(
            "Docker is not installed on this server".into(),
        ));
    }
    if lower.contains("cannot connect to the docker daemon")
        || lower.contains("is the docker daemon running")
    {
        return Err(SshError::IoError(
            "Docker daemon is not running".into(),
        ));
    }
    if lower.contains("permission denied") || lower.contains("got permission denied") {
        return Err(SshError::IoError(
            "Permission denied. Try: sudo usermod -aG docker $USER".into(),
        ));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

fn parse_docker_info(raw: &str) -> Result<DockerInfo, SshError> {
    let v: serde_json::Value = serde_json::from_str(raw.trim())
        .map_err(|e| SshError::IoError(format!("Failed to parse docker info JSON: {}", e)))?;

    Ok(DockerInfo {
        version: v["ServerVersion"]
            .as_str()
            .unwrap_or("unknown")
            .to_string(),
        containers_running: v["ContainersRunning"].as_u64().unwrap_or(0) as u32,
        containers_stopped: v["ContainersStopped"].as_u64().unwrap_or(0) as u32,
        containers_paused: v["ContainersPaused"].as_u64().unwrap_or(0) as u32,
        images: v["Images"].as_u64().unwrap_or(0) as u32,
    })
}

fn parse_docker_ps(raw: &str) -> Vec<ContainerInfo> {
    raw.lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| {
            let v: serde_json::Value = serde_json::from_str(line).ok()?;
            Some(ContainerInfo {
                id: v["ID"].as_str().unwrap_or("").to_string(),
                name: v["Names"].as_str().unwrap_or("").to_string(),
                image: v["Image"].as_str().unwrap_or("").to_string(),
                state: v["State"].as_str().unwrap_or("").to_string(),
                status: v["Status"].as_str().unwrap_or("").to_string(),
                ports: parse_ports_string(v["Ports"].as_str().unwrap_or("")),
            })
        })
        .collect()
}

fn parse_ports_string(ports: &str) -> Vec<String> {
    if ports.is_empty() {
        return Vec::new();
    }
    ports.split(", ").map(|s| s.to_string()).collect()
}

fn parse_docker_stats(raw: &str) -> Vec<ContainerStats> {
    raw.lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| {
            let v: serde_json::Value = serde_json::from_str(line).ok()?;
            Some(ContainerStats {
                name: v["Name"].as_str().unwrap_or("").to_string(),
                cpu_pct: parse_pct_str(v["CPUPerc"].as_str().unwrap_or("0%")),
                mem_usage_mb: parse_mem_usage_str(
                    v["MemUsage"].as_str().unwrap_or("0B / 0B"),
                ),
                mem_pct: parse_pct_str(v["MemPerc"].as_str().unwrap_or("0%")),
                net_rx_mb: parse_io_part(v["NetIO"].as_str().unwrap_or("0B / 0B"), 0),
                net_tx_mb: parse_io_part(v["NetIO"].as_str().unwrap_or("0B / 0B"), 1),
                block_read_mb: parse_io_part(
                    v["BlockIO"].as_str().unwrap_or("0B / 0B"),
                    0,
                ),
                block_write_mb: parse_io_part(
                    v["BlockIO"].as_str().unwrap_or("0B / 0B"),
                    1,
                ),
                pids: v["PIDs"]
                    .as_str()
                    .unwrap_or("0")
                    .trim()
                    .parse::<u32>()
                    .unwrap_or(0),
            })
        })
        .collect()
}

/// Parse "0.50%" into 0.50f32.
fn parse_pct_str(s: &str) -> f32 {
    s.trim().trim_end_matches('%').parse::<f32>().unwrap_or(0.0)
}

/// Parse the first part of "100MiB / 1GiB" into MB.
fn parse_mem_usage_str(s: &str) -> f32 {
    let parts: Vec<&str> = s.split('/').collect();
    if parts.is_empty() {
        return 0.0;
    }
    parse_size_to_mb(parts[0].trim())
}

/// Parse the Nth part (0 or 1) of an "X / Y" IO string into MB.
fn parse_io_part(s: &str, index: usize) -> f32 {
    let parts: Vec<&str> = s.split('/').collect();
    parts
        .get(index)
        .map(|p| parse_size_to_mb(p.trim()))
        .unwrap_or(0.0)
}

/// Convert a human-readable size string (e.g. "100MiB", "1.5GiB", "500kB") to MB.
fn parse_size_to_mb(s: &str) -> f32 {
    let s = s.trim();
    if s.is_empty() {
        return 0.0;
    }
    let num_end = s
        .find(|c: char| !c.is_ascii_digit() && c != '.')
        .unwrap_or(s.len());
    let value: f32 = s[..num_end].parse().unwrap_or(0.0);
    let unit = s[num_end..].trim().to_lowercase();

    match unit.as_str() {
        "b" => value / 1_000_000.0,
        "kb" | "kib" => value / 1_000.0,
        "mb" | "mib" => value,
        "gb" | "gib" => value * 1_000.0,
        "tb" | "tib" => value * 1_000_000.0,
        _ => value,
    }
}

/// The set of allowed Docker container actions.
#[derive(Deserialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum DockerAction {
    Start,
    Stop,
    Restart,
}

impl DockerAction {
    fn as_str(self) -> &'static str {
        match self {
            DockerAction::Start => "start",
            DockerAction::Stop => "stop",
            DockerAction::Restart => "restart",
        }
    }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const DOCKER_DELIM: &str = "---DOCKER_DELIM---";

/// Detect the remote OS. Outputs both cmd.exe and PowerShell env var syntax.
/// - cmd.exe:    `%OS%` expands to "Windows_NT", `$env:OS` is literal → output contains "Windows_NT"
/// - PowerShell: `%OS%` is literal, `$env:OS` expands to "Windows_NT" → output contains "Windows_NT"
/// - bash/zsh:   `%OS%` is literal, `$env:OS` is empty/literal → no "Windows_NT"
const OS_PROBE_CMD: &str = "echo %OS% $env:OS";

/// Check if the OS probe output indicates Windows.
fn is_windows_probe(output: &str) -> bool {
    output.contains("Windows_NT")
}

/// Common Docker binary paths that may not be in the minimal SSH exec PATH.
/// macOS: /usr/local/bin, Homebrew ARM: /opt/homebrew/bin, snap: /snap/bin
const UNIX_DOCKER_PATH_PREFIX: &str =
    "export PATH=\"/usr/local/bin:/opt/homebrew/bin:/snap/bin:$PATH\"; ";

/// Build a docker command string with proper OS-aware quoting.
/// On Unix, prepends common PATH directories so docker is found on macOS SSH exec channels.
fn docker_cmd(is_windows: bool, cmd: &str) -> String {
    if is_windows {
        cmd.to_string()
    } else {
        format!("{}{}", UNIX_DOCKER_PATH_PREFIX, cmd)
    }
}

/// Strip UTF-16LE artifacts (null bytes, BOM) from PowerShell output.
/// PowerShell's `-EncodedCommand` may produce UTF-16LE stdout, which
/// `String::from_utf8_lossy` preserves as null bytes between characters.
fn strip_powershell_artifacts(s: &str) -> String {
    s.replace('\0', "").replace('\u{feff}', "")
}

/// Build the docker data command for a Unix shell.
fn docker_data_command_unix() -> String {
    format!(
        "{}docker info --format '{{{{json .}}}}' 2>&1 && echo '{}' && \
         docker ps -a --format '{{{{json .}}}}' 2>&1 && echo '{}' && \
         docker stats --no-stream --format '{{{{json .}}}}' 2>&1",
        UNIX_DOCKER_PATH_PREFIX, DOCKER_DELIM, DOCKER_DELIM
    )
}

/// Build the docker data command for Windows using PowerShell -EncodedCommand
/// to avoid all shell escaping issues with cmd.exe and PowerShell.
fn docker_data_command_windows() -> String {
    use base64::Engine;

    let delim = DOCKER_DELIM;
    let ps_script = format!(
        "docker info --format '{{{{json .}}}}'\n\
         Write-Output '{delim}'\n\
         docker ps -a --format '{{{{json .}}}}'\n\
         Write-Output '{delim}'\n\
         docker stats --no-stream --format '{{{{json .}}}}'",
    );

    let utf16: Vec<u8> = ps_script
        .encode_utf16()
        .flat_map(|u| u.to_le_bytes())
        .collect();
    let encoded = base64::engine::general_purpose::STANDARD.encode(&utf16);
    format!("powershell -NoProfile -EncodedCommand {}", encoded)
}

/// Collect Docker data (info, containers, stats) from a remote host.
#[tauri::command]
pub async fn ssh_docker_data(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<DockerData, SshError> {
    AssertSend(async move {
        // Probe the remote OS to choose correct shell quoting.
        // "echo %COMSPEC%" expands to the cmd.exe path on Windows, prints literal on Unix.
        let (probe_out, _) = ssh_exec_raw(&state, &session_id, OS_PROBE_CMD, 5).await?;
        let is_windows = is_windows_probe(&probe_out);

        let command = if is_windows {
            docker_data_command_windows()
        } else {
            docker_data_command_unix()
        };

        let (raw_stdout, stderr) =
            ssh_exec_raw(&state, &session_id, &command, 30).await?;

        // Windows PowerShell via -EncodedCommand may output UTF-16LE with
        // null bytes and BOM — strip those artifacts before processing.
        let stdout = if is_windows {
            strip_powershell_artifacts(&raw_stdout)
        } else {
            raw_stdout
        };

        // Check both stdout and stderr for docker-specific errors.
        let combined = format!("{}\n{}", stdout, stderr);
        check_docker_errors(&combined)?;

        // Split output by delimiter.
        let sections: Vec<&str> = stdout.split(DOCKER_DELIM).collect();
        if sections.len() < 3 {
            return Err(SshError::IoError(
                "Unexpected docker output format: missing delimiters".into(),
            ));
        }

        let info = parse_docker_info(sections[0])?;
        let containers = parse_docker_ps(sections[1]);
        let stats = parse_docker_stats(sections[2]);

        Ok(DockerData {
            info,
            containers,
            stats,
        })
    })
    .await
}

/// Fetch the last 50 lines of logs for a specific container.
#[tauri::command]
pub async fn ssh_docker_logs(
    state: State<'_, AppState>,
    session_id: String,
    container_name: String,
) -> Result<String, SshError> {
    AssertSend(async move {
        // Probe OS for correct stderr redirect syntax
        let (probe_out, _) = ssh_exec_raw(&state, &session_id, OS_PROBE_CMD, 5).await?;
        let is_windows = is_windows_probe(&probe_out);
        let redir = if is_windows { "2>nul" } else { "2>&1" };
        let command = docker_cmd(is_windows, &format!("docker logs --tail 50 {} {}", container_name, redir));

        let (raw_stdout, stderr) =
            ssh_exec_raw(&state, &session_id, &command, 15).await?;

        let stdout = if is_windows { strip_powershell_artifacts(&raw_stdout) } else { raw_stdout };
        let combined = format!("{}\n{}", stdout, stderr);
        check_docker_errors(&combined)?;

        Ok(stdout)
    })
    .await
}

/// Run a Docker action (start / stop / restart) on a container.
#[tauri::command]
pub async fn ssh_docker_action(
    state: State<'_, AppState>,
    session_id: String,
    container_name: String,
    action: DockerAction,
) -> Result<String, SshError> {
    AssertSend(async move {
        let (probe_out, _) = ssh_exec_raw(&state, &session_id, OS_PROBE_CMD, 5).await?;
        let is_windows = is_windows_probe(&probe_out);
        let redir = if is_windows { "2>nul" } else { "2>&1" };
        let command = docker_cmd(is_windows, &format!(
            "docker {} {} {}",
            action.as_str(),
            container_name,
            redir
        ));

        let (raw_stdout, stderr) = ssh_exec_raw(&state, &session_id, &command, 30).await?;

        let stdout = if is_windows { strip_powershell_artifacts(&raw_stdout) } else { raw_stdout };
        let combined = format!("{}\n{}", stdout, stderr);
        check_docker_errors(&combined)?;

        // If stderr contains a real error (not just empty / redirect noise), report it.
        let err_trimmed = stderr.trim();
        if !err_trimmed.is_empty() && !err_trimmed.contains("nul") {
            return Err(SshError::IoError(format!(
                "docker {} failed: {}",
                action.as_str(),
                err_trimmed
            )));
        }

        Ok(stdout.trim().to_string())
    })
    .await
}

/// Run `docker inspect` on a container and return the raw JSON string.
#[tauri::command]
pub async fn ssh_docker_inspect(
    state: State<'_, AppState>,
    session_id: String,
    container_name: String,
) -> Result<String, SshError> {
    AssertSend(async move {
        let (probe_out, _) = ssh_exec_raw(&state, &session_id, OS_PROBE_CMD, 5).await?;
        let is_windows = is_windows_probe(&probe_out);
        let redir = if is_windows { "2>nul" } else { "2>&1" };
        let command = docker_cmd(is_windows, &format!("docker inspect {} {}", container_name, redir));

        let (raw_stdout, stderr) = ssh_exec_raw(&state, &session_id, &command, 15).await?;

        let stdout = if is_windows { strip_powershell_artifacts(&raw_stdout) } else { raw_stdout };
        let combined = format!("{}\n{}", stdout, stderr);
        check_docker_errors(&combined)?;

        Ok(stdout)
    })
    .await
}
