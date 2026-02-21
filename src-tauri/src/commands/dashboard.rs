// Dashboard Tauri commands — server metrics over SSH exec channels

use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::State;

use crate::error::SshError;
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Serialize, Clone)]
pub struct CpuCore {
    pub id: u8,
    pub usage_pct: f32,
}

#[derive(Serialize, Clone)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_pct: f32,
    pub mem_pct: f32,
    pub state: String,
    pub vsz: u64,
}

#[derive(Serialize, Clone)]
pub struct ServerMetrics {
    pub cpu_total_pct: f32,
    pub cpu_cores: Vec<CpuCore>,
    pub load_avg: [f32; 3],
    pub mem_total_kb: u64,
    pub mem_used_kb: u64,
    pub mem_cached_kb: u64,
    pub swap_total_kb: u64,
    pub swap_used_kb: u64,
    pub disk_read_bps: u64,
    pub disk_write_bps: u64,
    pub net_rx_bps: u64,
    pub net_tx_bps: u64,
    pub processes: Vec<ProcessInfo>,
    pub uptime_secs: u64,
}

#[derive(Clone)]
pub struct MetricsSnapshot {
    pub timestamp: Instant,
    pub cpu_times: Vec<(u64, u64)>, // (idle, total) per core including cpu-total at index 0
    pub disk_read_sectors: u64,
    pub disk_write_sectors: u64,
    pub net_rx_bytes: u64,
    pub net_tx_bytes: u64,
}

// ---------------------------------------------------------------------------
// AssertSend wrapper (same pattern as ssh.rs)
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
// Delimiter used to split compound command output
// ---------------------------------------------------------------------------

const DELIMITER: &str = "---DELIMITER---";

const METRICS_COMMAND: &str = "\
cat /proc/stat && echo '---DELIMITER---' && \
cat /proc/meminfo && echo '---DELIMITER---' && \
cat /proc/loadavg && echo '---DELIMITER---' && \
cat /proc/diskstats && echo '---DELIMITER---' && \
cat /proc/net/dev && echo '---DELIMITER---' && \
cat /proc/uptime && echo '---DELIMITER---' && \
ps aux --no-headers | sort -rk3 | head -20";

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/// Parse /proc/stat — returns Vec of (idle, total) where index 0 is aggregate cpu.
fn parse_cpu_stat(section: &str) -> Vec<(u64, u64)> {
    let mut cores = Vec::new();
    for line in section.lines() {
        if !line.starts_with("cpu") {
            continue;
        }
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 5 {
            continue;
        }
        // fields: user nice system idle [iowait irq softirq steal ...]
        let values: Vec<u64> = parts[1..].iter().filter_map(|v| v.parse().ok()).collect();
        if values.len() < 4 {
            continue;
        }
        let idle = values[3] + values.get(4).copied().unwrap_or(0); // idle + iowait
        let total: u64 = values.iter().sum();
        cores.push((idle, total));
    }
    cores
}

/// Parse /proc/meminfo — returns (total, free, buffers, cached, swap_total, swap_free).
fn parse_meminfo(section: &str) -> (u64, u64, u64, u64, u64, u64) {
    let mut total = 0u64;
    let mut free = 0u64;
    let mut buffers = 0u64;
    let mut cached = 0u64;
    let mut swap_total = 0u64;
    let mut swap_free = 0u64;

    for line in section.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 2 {
            continue;
        }
        let val: u64 = parts[1].parse().unwrap_or(0);
        match parts[0] {
            "MemTotal:" => total = val,
            "MemFree:" => free = val,
            "Buffers:" => buffers = val,
            "Cached:" => cached = val,
            "SwapTotal:" => swap_total = val,
            "SwapFree:" => swap_free = val,
            _ => {}
        }
    }
    (total, free, buffers, cached, swap_total, swap_free)
}

/// Parse /proc/loadavg — returns [1min, 5min, 15min].
fn parse_loadavg(section: &str) -> [f32; 3] {
    let parts: Vec<&str> = section.trim().split_whitespace().collect();
    let mut avg = [0.0f32; 3];
    for (i, p) in parts.iter().take(3).enumerate() {
        avg[i] = p.parse().unwrap_or(0.0);
    }
    avg
}

/// Parse /proc/diskstats — returns (total_read_sectors, total_write_sectors)
/// for sd* and nvme* devices only.
fn parse_diskstats(section: &str) -> (u64, u64) {
    let mut read_sectors = 0u64;
    let mut write_sectors = 0u64;

    for line in section.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 10 {
            continue;
        }
        let dev = parts[2];
        // Only count whole-disk devices, not partitions (sd[a-z], nvme[0-9]n[0-9])
        let is_disk = (dev.starts_with("sd") && dev.len() == 3)
            || (dev.starts_with("nvme") && dev.contains('n') && !dev.contains('p'));
        if !is_disk {
            continue;
        }
        // field 5 (index 5) = sectors read, field 9 (index 9) = sectors written
        read_sectors += parts[5].parse::<u64>().unwrap_or(0);
        write_sectors += parts[9].parse::<u64>().unwrap_or(0);
    }
    (read_sectors, write_sectors)
}

/// Parse /proc/net/dev — returns (total_rx_bytes, total_tx_bytes) for non-lo interfaces.
fn parse_net_dev(section: &str) -> (u64, u64) {
    let mut rx_bytes = 0u64;
    let mut tx_bytes = 0u64;

    for line in section.lines() {
        let line = line.trim();
        // Skip header lines (contain |)
        if line.contains('|') || line.is_empty() {
            continue;
        }
        // Format: "iface: rx_bytes rx_packets ... tx_bytes tx_packets ..."
        let Some((iface, rest)) = line.split_once(':') else {
            continue;
        };
        if iface.trim() == "lo" {
            continue;
        }
        let fields: Vec<&str> = rest.split_whitespace().collect();
        if fields.len() < 10 {
            continue;
        }
        // field 0 = rx_bytes, field 8 = tx_bytes
        rx_bytes += fields[0].parse::<u64>().unwrap_or(0);
        tx_bytes += fields[8].parse::<u64>().unwrap_or(0);
    }
    (rx_bytes, tx_bytes)
}

/// Parse /proc/uptime — returns uptime in seconds.
fn parse_uptime(section: &str) -> u64 {
    section
        .trim()
        .split_whitespace()
        .next()
        .and_then(|s| s.parse::<f64>().ok())
        .map(|v| v as u64)
        .unwrap_or(0)
}

/// Parse ps aux output — returns top processes.
fn parse_processes(section: &str) -> Vec<ProcessInfo> {
    let mut procs = Vec::new();
    for line in section.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        // USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND...
        let parts: Vec<&str> = line.splitn(11, char::is_whitespace).collect();
        // Filter out empty parts from consecutive whitespace
        let parts: Vec<&str> = parts.into_iter().filter(|s| !s.is_empty()).collect();
        if parts.len() < 11 {
            // Re-parse with splitn on whitespace properly
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 11 {
                continue;
            }
            procs.push(ProcessInfo {
                pid: parts[1].parse().unwrap_or(0),
                cpu_pct: parts[2].parse().unwrap_or(0.0),
                mem_pct: parts[3].parse().unwrap_or(0.0),
                vsz: parts[4].parse().unwrap_or(0),
                state: parts[7].to_string(),
                name: parts[10..].join(" "),
            });
            continue;
        }
        procs.push(ProcessInfo {
            pid: parts[1].parse().unwrap_or(0),
            cpu_pct: parts[2].parse().unwrap_or(0.0),
            mem_pct: parts[3].parse().unwrap_or(0.0),
            vsz: parts[4].parse().unwrap_or(0),
            state: parts[7].to_string(),
            name: parts[10..].join(" "),
        });
    }
    procs
}

/// Compute CPU usage percentages from delta between two snapshots.
fn compute_cpu_usage(
    prev: &[(u64, u64)],
    curr: &[(u64, u64)],
) -> (f32, Vec<CpuCore>) {
    let mut total_pct = 0.0f32;
    let mut cores = Vec::new();

    for (i, (curr_idle, curr_total)) in curr.iter().enumerate() {
        let (prev_idle, prev_total) = prev.get(i).copied().unwrap_or((0, 0));
        let delta_total = curr_total.saturating_sub(prev_total);
        let delta_idle = curr_idle.saturating_sub(prev_idle);
        let usage = if delta_total > 0 {
            (1.0 - (delta_idle as f64 / delta_total as f64)) as f32 * 100.0
        } else {
            0.0
        };

        if i == 0 {
            // Aggregate cpu line
            total_pct = usage;
        } else {
            cores.push(CpuCore {
                id: (i - 1) as u8,
                usage_pct: usage,
            });
        }
    }
    (total_pct, cores)
}

// ---------------------------------------------------------------------------
// Tauri command
// ---------------------------------------------------------------------------

/// Collect server metrics from a remote host over an existing SSH session.
///
/// Executes a compound command via an exec channel, parses /proc filesystem
/// data, and computes delta-based rates (CPU%, disk I/O, network) using
/// snapshots stored in AppState.
#[tauri::command]
pub async fn ssh_get_metrics(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<ServerMetrics, SshError> {
    AssertSend(async move {
        let now = Instant::now();

        // 1. Get SSH handle and execute compound command
        let ssh_handle = state.ssh_manager.get_ssh_handle(&session_id)?;
        let handle = ssh_handle.lock().await;

        let mut channel = handle
            .channel_open_session()
            .await
            .map_err(|e| {
                SshError::ChannelClosed(format!("Failed to open exec channel: {}", e))
            })?;

        channel
            .exec(true, METRICS_COMMAND.as_bytes())
            .await
            .map_err(|e| SshError::ChannelClosed(format!("exec failed: {}", e)))?;

        // Drop handle lock before reading to avoid deadlocks
        drop(handle);

        // 2. Read output with 15s timeout
        let mut stdout = Vec::new();
        let result = tokio::time::timeout(Duration::from_secs(15), async {
            loop {
                match channel.wait().await {
                    Some(russh::ChannelMsg::Data { data }) => {
                        stdout.extend_from_slice(&data);
                    }
                    Some(russh::ChannelMsg::ExitStatus { .. }) => {}
                    None => break,
                    _ => {}
                }
            }
        })
        .await;

        if result.is_err() {
            return Err(SshError::Timeout(
                "Metrics command timed out after 15 seconds".into(),
            ));
        }

        let raw = String::from_utf8_lossy(&stdout);

        // 3. Split by delimiter
        let sections: Vec<&str> = raw.split(DELIMITER).collect();
        if sections.len() < 7 {
            return Err(SshError::IoError(format!(
                "Expected 7 sections in metrics output, got {}",
                sections.len()
            )));
        }

        // 4. Parse each section
        let cpu_times = parse_cpu_stat(sections[0]);
        let (mem_total, mem_free, buffers, cached, swap_total, swap_free) =
            parse_meminfo(sections[1]);
        let load_avg = parse_loadavg(sections[2]);
        let (disk_read_sectors, disk_write_sectors) = parse_diskstats(sections[3]);
        let (net_rx_bytes, net_tx_bytes) = parse_net_dev(sections[4]);
        let uptime_secs = parse_uptime(sections[5]);
        let processes = parse_processes(sections[6]);

        // 5. Compute deltas from previous snapshot
        let prev_snapshot = state.metrics_snapshots.get(&session_id).map(|r| r.clone());

        let (cpu_total_pct, cpu_cores, disk_read_bps, disk_write_bps, net_rx_bps, net_tx_bps) =
            match prev_snapshot {
                Some(prev) => {
                    let dt = now.duration_since(prev.timestamp).as_secs_f64().max(0.1);

                    let (cpu_total_pct, cpu_cores) =
                        compute_cpu_usage(&prev.cpu_times, &cpu_times);

                    let disk_read_delta =
                        disk_read_sectors.saturating_sub(prev.disk_read_sectors);
                    let disk_write_delta =
                        disk_write_sectors.saturating_sub(prev.disk_write_sectors);
                    // Sector size = 512 bytes
                    let disk_read_bps = ((disk_read_delta * 512) as f64 / dt) as u64;
                    let disk_write_bps = ((disk_write_delta * 512) as f64 / dt) as u64;

                    let net_rx_delta = net_rx_bytes.saturating_sub(prev.net_rx_bytes);
                    let net_tx_delta = net_tx_bytes.saturating_sub(prev.net_tx_bytes);
                    let net_rx_bps = (net_rx_delta as f64 / dt) as u64;
                    let net_tx_bps = (net_tx_delta as f64 / dt) as u64;

                    (
                        cpu_total_pct,
                        cpu_cores,
                        disk_read_bps,
                        disk_write_bps,
                        net_rx_bps,
                        net_tx_bps,
                    )
                }
                None => {
                    // First call — no deltas available
                    let cores: Vec<CpuCore> = cpu_times
                        .iter()
                        .skip(1)
                        .enumerate()
                        .map(|(i, _)| CpuCore {
                            id: i as u8,
                            usage_pct: 0.0,
                        })
                        .collect();
                    (0.0, cores, 0, 0, 0, 0)
                }
            };

        // 6. Store new snapshot
        state.metrics_snapshots.insert(
            session_id,
            MetricsSnapshot {
                timestamp: now,
                cpu_times,
                disk_read_sectors,
                disk_write_sectors,
                net_rx_bytes,
                net_tx_bytes,
            },
        );

        // 7. Build result
        let mem_used_kb = mem_total.saturating_sub(mem_free + buffers + cached);

        Ok(ServerMetrics {
            cpu_total_pct,
            cpu_cores,
            load_avg,
            mem_total_kb: mem_total,
            mem_used_kb,
            mem_cached_kb: cached,
            swap_total_kb: swap_total,
            swap_used_kb: swap_total.saturating_sub(swap_free),
            disk_read_bps,
            disk_write_bps,
            net_rx_bps,
            net_tx_bps,
            processes,
            uptime_secs,
        })
    })
    .await
}
