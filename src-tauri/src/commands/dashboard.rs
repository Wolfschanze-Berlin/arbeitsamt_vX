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

/// Cross-platform metrics command: detects Linux vs macOS and runs the
/// appropriate commands.  Both branches produce 7 sections separated by
/// `---DELIMITER---` so the parser can handle them uniformly.
const METRICS_COMMAND: &str = "\
if [ -d /proc ]; then \
  cat /proc/stat && echo '---DELIMITER---' && \
  cat /proc/meminfo && echo '---DELIMITER---' && \
  cat /proc/loadavg && echo '---DELIMITER---' && \
  cat /proc/diskstats && echo '---DELIMITER---' && \
  cat /proc/net/dev && echo '---DELIMITER---' && \
  cat /proc/uptime && echo '---DELIMITER---' && \
  ps aux --no-headers | sort -rk3 | head -20; \
else \
  echo '__MACOS__' && \
  top -l 1 -n 0 -s 0 2>/dev/null | head -12 && echo '---DELIMITER---' && \
  vm_stat 2>/dev/null && sysctl -n hw.memsize 2>/dev/null && echo '---DELIMITER---' && \
  sysctl -n vm.loadavg 2>/dev/null && echo '---DELIMITER---' && \
  iostat -d -c 1 2>/dev/null | tail -n +3 && echo '---DELIMITER---' && \
  netstat -ib 2>/dev/null && echo '---DELIMITER---' && \
  sysctl -n kern.boottime 2>/dev/null && echo '---DELIMITER---' && \
  ps -eo pid,pcpu,pmem,vsz,state,comm 2>/dev/null | sort -rnk2 | head -20; \
fi";

/// Detect the remote OS. Outputs both cmd.exe and PowerShell env var syntax.
/// - cmd.exe:    `%OS%` expands to "Windows_NT", `$env:OS` is literal
/// - PowerShell: `%OS%` is literal, `$env:OS` expands to "Windows_NT"
/// - bash/zsh:   neither expands → no "Windows_NT" in output
const OS_PROBE: &str = "echo %OS% $env:OS";

/// Windows metrics via PowerShell, producing 7 ---DELIMITER--- sections:
///   0: __WINDOWS__ + CPU usage per core (pre-computed percentages)
///   1: Memory (MemTotal/MemFree/SwapTotal/SwapFree in KB, /proc/meminfo style)
///   2: Load average (approximated from processor queue + CPU%)
///   3: Disk I/O bytes (cumulative)
///   4: Network bytes (cumulative rx/tx)
///   5: Uptime in seconds
///   6: Top 20 processes
const WINDOWS_METRICS_PS: &str = r#"
$d = '---DELIMITER---'
# -- Section 0: CPU --
Write-Output '__WINDOWS__'
$cpus = Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor
foreach ($c in ($cpus | Sort-Object Name)) {
  $idle = [uint64]$c.PercentIdleTime
  $total = 100
  if ($c.Name -eq '_Total') { Write-Output "cpu $idle $total" }
  else { Write-Output "cpu$($c.Name) $idle $total" }
}
Write-Output $d
# -- Section 1: Memory (KB, mimics /proc/meminfo keys) --
$os = Get-CimInstance Win32_OperatingSystem
$pi = Get-CimInstance Win32_PageFileUsage -ErrorAction SilentlyContinue | Measure-Object -Property CurrentUsage,AllocatedBaseSize -Sum
$swapTotalKB = if($pi.Count -gt 0){[uint64]($os.SizeStoredInPagingFiles)}else{0}
$swapFreeKB = $swapTotalKB - [uint64]$os.SizeStoredInPagingFiles + [uint64]$os.FreeSpaceInPagingFiles
Write-Output "MemTotal: $($os.TotalVisibleMemorySize) kB"
Write-Output "MemFree: $($os.FreePhysicalMemory) kB"
Write-Output "Buffers: 0 kB"
Write-Output "Cached: 0 kB"
Write-Output "SwapTotal: $swapTotalKB kB"
Write-Output "SwapFree: $swapFreeKB kB"
Write-Output $d
# -- Section 2: Load average (approx from CPU%) --
$cpuLoad = ($cpus | Where-Object {$_.Name -eq '_Total'}).PercentProcessorTime
$la = [math]::Round($cpuLoad / 100.0 * (Get-CimInstance Win32_Processor).NumberOfLogicalProcessors, 2)
Write-Output "$la $la $la"
Write-Output $d
# -- Section 3: Disk I/O (cumulative bytes) --
$disk = Get-CimInstance Win32_PerfRawData_PerfDisk_PhysicalDisk | Where-Object {$_.Name -eq '_Total'}
if ($disk) {
  Write-Output "disk_read_bytes $($disk.DiskReadBytesPerSec)"
  Write-Output "disk_write_bytes $($disk.DiskWriteBytesPerSec)"
} else { Write-Output "disk_read_bytes 0"; Write-Output "disk_write_bytes 0" }
Write-Output $d
# -- Section 4: Network (cumulative bytes) --
$rx = 0; $tx = 0
try {
  Get-NetAdapterStatistics -ErrorAction Stop | ForEach-Object { $rx += $_.ReceivedBytes; $tx += $_.SentBytes }
} catch {
  $nics = Get-CimInstance Win32_PerfRawData_Tcpip_NetworkInterface -ErrorAction SilentlyContinue
  if ($nics) { $nics | ForEach-Object { $rx += $_.BytesReceivedPerSec; $tx += $_.BytesSentPerSec } }
}
Write-Output "net_rx_bytes $rx"
Write-Output "net_tx_bytes $tx"
Write-Output $d
# -- Section 5: Uptime (seconds) --
$boot = $os.LastBootUpTime
$up = [uint64]((Get-Date) - $boot).TotalSeconds
Write-Output "$up 0"
Write-Output $d
# -- Section 6: Top 20 processes --
Get-Process | Sort-Object CPU -Descending -ErrorAction SilentlyContinue | Select-Object -First 20 | ForEach-Object {
  $cpuPct = if($_.CPU){[math]::Round($_.CPU / ((Get-Date)-$_.StartTime).TotalSeconds * 100, 1)}else{0}
  $memPct = [math]::Round($_.WorkingSet64 / $os.TotalVisibleMemorySize / 1024 * 100, 1)
  Write-Output "$($_.Id) $cpuPct $memPct $([math]::Round($_.VirtualMemorySize64/1024)) Running $($_.ProcessName)"
}
"#;

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

// ---------------------------------------------------------------------------
// macOS parsing helpers
// ---------------------------------------------------------------------------

/// Parse macOS `top -l 1` output for CPU info.
/// Returns synthetic (idle, total) tuples compatible with compute_cpu_usage.
/// top output includes lines like:
///   CPU usage: 5.26% user, 10.52% sys, 84.21% idle
fn parse_macos_cpu(section: &str) -> Vec<(u64, u64)> {
    let mut idle_pct = 0.0f64;
    let mut user_pct = 0.0f64;
    let mut sys_pct = 0.0f64;

    for line in section.lines() {
        let line = line.trim();
        if line.starts_with("CPU usage:") {
            // Parse "5.26% user, 10.52% sys, 84.21% idle"
            for part in line["CPU usage:".len()..].split(',') {
                let part = part.trim();
                if part.ends_with("% user") || part.ends_with("user") {
                    if let Some(val) = part.split('%').next() {
                        user_pct = val.trim().parse().unwrap_or(0.0);
                    }
                } else if part.ends_with("% sys") || part.ends_with("sys") {
                    if let Some(val) = part.split('%').next() {
                        sys_pct = val.trim().parse().unwrap_or(0.0);
                    }
                } else if part.ends_with("% idle") || part.ends_with("idle") {
                    if let Some(val) = part.split('%').next() {
                        idle_pct = val.trim().parse().unwrap_or(0.0);
                    }
                }
            }
        }
    }

    // Synthesize a single aggregate "core" (index 0)
    let total = 10000u64; // Use fixed scale
    let idle = (idle_pct / 100.0 * total as f64) as u64;
    let used = ((user_pct + sys_pct) / 100.0 * total as f64) as u64;
    // Return aggregate + 1 virtual core so the frontend shows something
    vec![(idle, total), (total - used.min(total), total)]
}

/// Parse macOS `vm_stat` + `sysctl hw.memsize` for memory info.
/// Returns (total_kb, free_kb, buffers_kb, cached_kb, swap_total_kb, swap_free_kb).
fn parse_macos_mem(section: &str) -> (u64, u64, u64, u64, u64, u64) {
    let mut page_size: u64 = 16384; // Default Apple Silicon page size
    let mut pages_free: u64 = 0;
    let mut pages_active: u64 = 0;
    let mut pages_inactive: u64 = 0;
    let mut pages_speculative: u64 = 0;
    let mut pages_wired: u64 = 0;
    let mut pages_purgeable: u64 = 0;
    let mut total_bytes: u64 = 0;
    let mut swapins: u64 = 0;
    let mut swapouts: u64 = 0;

    for line in section.lines() {
        let line = line.trim();

        // vm_stat header: "Mach Virtual Memory Statistics: (page size of 16384 bytes)"
        if line.contains("page size of") {
            if let Some(s) = line.split("page size of ").nth(1) {
                if let Some(num) = s.split_whitespace().next() {
                    page_size = num.parse().unwrap_or(16384);
                }
            }
            continue;
        }

        // vm_stat entries: "Pages free:    123456."
        if let Some((key, val)) = line.split_once(':') {
            let val = val.trim().trim_end_matches('.');
            let v: u64 = val.parse().unwrap_or(0);
            match key.trim() {
                "Pages free" => pages_free = v,
                "Pages active" => pages_active = v,
                "Pages inactive" => pages_inactive = v,
                "Pages speculative" => pages_speculative = v,
                "Pages wired down" => pages_wired = v,
                "Pages purgeable" => pages_purgeable = v,
                "Swapins" => swapins = v,
                "Swapouts" => swapouts = v,
                _ => {}
            }
            continue;
        }

        // hw.memsize output: just a number (bytes)
        if let Ok(bytes) = line.parse::<u64>() {
            if bytes > 1_000_000_000 {
                total_bytes = bytes;
            }
        }
    }

    let total_kb = total_bytes / 1024;
    let free_kb = (pages_free + pages_speculative) * page_size / 1024;
    let cached_kb = (pages_inactive + pages_purgeable) * page_size / 1024;
    let used_kb = (pages_active + pages_wired) * page_size / 1024;
    let buffers_kb: u64 = 0; // macOS doesn't separate buffers

    // macOS doesn't expose swap total easily
    let swap_total_kb: u64 = 0;
    let swap_free_kb: u64 = 0;
    let _ = (swapins, swapouts, used_kb); // suppress warnings

    (total_kb, free_kb, buffers_kb, cached_kb, swap_total_kb, swap_free_kb)
}

/// Parse macOS `sysctl -n vm.loadavg` output.
/// Format: "{ 1.23 4.56 7.89 }"
fn parse_macos_loadavg(section: &str) -> [f32; 3] {
    let trimmed = section.trim().trim_start_matches('{').trim_end_matches('}');
    let parts: Vec<&str> = trimmed.split_whitespace().collect();
    let mut avg = [0.0f32; 3];
    for (i, p) in parts.iter().take(3).enumerate() {
        avg[i] = p.parse().unwrap_or(0.0);
    }
    avg
}

/// Parse macOS `iostat -d -c 1` output for disk I/O.
/// Returns (read_sectors, write_sectors) — macOS reports KB, convert to 512B sectors.
fn parse_macos_diskstats(section: &str) -> (u64, u64) {
    let mut total_read_kb = 0u64;
    let total_write_kb = 0u64;

    for line in section.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        // iostat -d output: KB/t tps MB/s  (3 columns per device)
        // We approximate from MB/s column
        if parts.len() >= 3 {
            // Try to parse as numbers (skip header lines)
            if let Ok(mbs) = parts[2].parse::<f64>() {
                // This is MB/s for reads — not perfect but gives a ballpark
                total_read_kb += (mbs * 1024.0) as u64;
            }
        }
    }

    // Convert KB to 512-byte sectors for compatibility
    (total_read_kb * 2, total_write_kb * 2)
}

/// Parse macOS `netstat -ib` for network bytes.
/// Returns (rx_bytes, tx_bytes) for non-lo interfaces.
fn parse_macos_net(section: &str) -> (u64, u64) {
    let mut rx_bytes = 0u64;
    let mut tx_bytes = 0u64;

    for line in section.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        // netstat -ib columns: Name Mtu Network Address Ipkts Ierrs Ibytes Opkts Oerrs Obytes ...
        if parts.len() < 10 {
            continue;
        }
        let iface = parts[0];
        if iface == "Name" || iface.starts_with("lo") {
            continue;
        }
        // Only count lines that have an IP address (filter link-level dups)
        // Ibytes = index 6, Obytes = index 9
        if let (Ok(ib), Ok(ob)) = (parts[6].parse::<u64>(), parts[9].parse::<u64>()) {
            rx_bytes += ib;
            tx_bytes += ob;
        }
    }
    (rx_bytes, tx_bytes)
}

/// Parse macOS `sysctl -n kern.boottime` for uptime.
/// Format: "{ sec = 1708000000, usec = 123456 } Thu Feb ..."
fn parse_macos_uptime(section: &str) -> u64 {
    // Extract "sec = NNNN" from the output
    if let Some(sec_pos) = section.find("sec = ") {
        let after = &section[sec_pos + 6..];
        if let Some(end) = after.find(',').or_else(|| after.find('}')) {
            if let Ok(boot_time) = after[..end].trim().parse::<u64>() {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                return now.saturating_sub(boot_time);
            }
        }
    }
    0
}

/// Parse macOS `ps -eo pid,pcpu,pmem,vsz,state,comm` output.
fn parse_macos_processes(section: &str) -> Vec<ProcessInfo> {
    let mut procs = Vec::new();
    for line in section.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("PID") {
            continue;
        }
        let parts: Vec<&str> = line.splitn(6, char::is_whitespace).collect();
        let parts: Vec<&str> = parts.into_iter().filter(|s| !s.is_empty()).collect();
        if parts.len() < 6 {
            // Retry with split_whitespace
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 6 {
                continue;
            }
            procs.push(ProcessInfo {
                pid: parts[0].parse().unwrap_or(0),
                cpu_pct: parts[1].parse().unwrap_or(0.0),
                mem_pct: parts[2].parse().unwrap_or(0.0),
                vsz: parts[3].parse().unwrap_or(0),
                state: parts[4].to_string(),
                name: parts[5..].join(" "),
            });
            continue;
        }
        procs.push(ProcessInfo {
            pid: parts[0].parse().unwrap_or(0),
            cpu_pct: parts[1].parse().unwrap_or(0.0),
            mem_pct: parts[2].parse().unwrap_or(0.0),
            vsz: parts[3].parse().unwrap_or(0),
            state: parts[4].to_string(),
            name: parts[5..].join(" "),
        });
    }
    procs
}

// ---------------------------------------------------------------------------

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
// Windows parsing helpers
// ---------------------------------------------------------------------------

/// Parse Windows CPU output: "__WINDOWS__\ncpu <idle> <total>\ncpu0 <idle> <total>\n..."
/// Same (idle, total) tuple format as Linux, where index 0 is the aggregate.
fn parse_windows_cpu(section: &str) -> Vec<(u64, u64)> {
    let mut cores = Vec::new();
    for line in section.lines() {
        if !line.starts_with("cpu") { continue; }
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 3 { continue; }
        let idle: u64 = parts[1].parse().unwrap_or(0);
        let total: u64 = parts[2].parse().unwrap_or(100);
        cores.push((idle, total));
    }
    if cores.is_empty() {
        cores.push((50, 100)); // fallback
    }
    cores
}

/// Parse Windows "key value" pairs for disk/net counters.
/// Example input: "disk_read_bytes 12345\ndisk_write_bytes 67890"
fn parse_windows_disk_net(section: &str, key_a: &str, key_b: &str) -> (u64, u64) {
    let mut a = 0u64;
    let mut b = 0u64;
    for line in section.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 2 { continue; }
        if parts[0] == key_a { a = parts[1].parse().unwrap_or(0); }
        if parts[0] == key_b { b = parts[1].parse().unwrap_or(0); }
    }
    (a, b)
}

/// Parse Windows process list: "PID CPU% MEM% VSZ State Name"
fn parse_windows_processes(section: &str) -> Vec<ProcessInfo> {
    let mut procs = Vec::new();
    for line in section.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 6 { continue; }
        let pid = match parts[0].parse::<u32>() {
            Ok(v) => v,
            Err(_) => continue,
        };
        procs.push(ProcessInfo {
            pid,
            cpu_pct: parts[1].parse().unwrap_or(0.0),
            mem_pct: parts[2].parse().unwrap_or(0.0),
            vsz: parts[3].parse().unwrap_or(0),
            state: parts[4].to_string(),
            name: parts[5..].join(" "),
        });
    }
    procs
}

// ---------------------------------------------------------------------------
// Tauri command
// ---------------------------------------------------------------------------

/// Build the Windows PowerShell metrics command with -EncodedCommand to avoid
/// shell escaping issues when the default SSH shell is cmd.exe.
fn build_windows_metrics_command() -> String {
    use base64::Engine;
    let utf16: Vec<u8> = WINDOWS_METRICS_PS
        .encode_utf16()
        .flat_map(|u| u.to_le_bytes())
        .collect();
    let encoded = base64::engine::general_purpose::STANDARD.encode(&utf16);
    format!("powershell -NoProfile -EncodedCommand {}", encoded)
}

/// Open an exec channel, run `command`, and return the stdout as a String.
async fn exec_and_read(
    ssh_handle: &std::sync::Arc<tokio::sync::Mutex<russh::client::Handle<crate::ssh::handler::ClientHandler>>>,
    command: &[u8],
    timeout_secs: u64,
) -> Result<String, SshError> {
    let handle = ssh_handle.lock().await;
    let mut channel = handle
        .channel_open_session()
        .await
        .map_err(|e| SshError::ChannelClosed(format!("Failed to open exec channel: {}", e)))?;
    channel
        .exec(true, command)
        .await
        .map_err(|e| SshError::ChannelClosed(format!("exec failed: {}", e)))?;
    drop(handle);

    let mut stdout = Vec::new();
    let result = tokio::time::timeout(Duration::from_secs(timeout_secs), async {
        loop {
            match channel.wait().await {
                Some(russh::ChannelMsg::Data { data }) => stdout.extend_from_slice(&data),
                Some(russh::ChannelMsg::ExitStatus { .. }) => {}
                None => break,
                _ => {}
            }
        }
    })
    .await;

    if result.is_err() {
        return Err(SshError::Timeout(format!(
            "Command timed out after {} seconds", timeout_secs
        )));
    }

    Ok(String::from_utf8_lossy(&stdout).into_owned())
}

/// Collect server metrics from a remote host over an existing SSH session.
///
/// Executes a compound command via an exec channel, parses /proc filesystem
/// data (or PowerShell output on Windows), and computes delta-based rates
/// (CPU%, disk I/O, network) using snapshots stored in AppState.
#[tauri::command]
pub async fn ssh_get_metrics(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<ServerMetrics, SshError> {
    AssertSend(async move {
        let now = Instant::now();

        // 1. Get SSH handle
        let ssh_handle = state.ssh_manager.get_ssh_handle(&session_id)?;

        // 1a. Probe OS: "echo %OS% $env:OS" outputs "Windows_NT" on both cmd.exe and PowerShell
        let probe = exec_and_read(&ssh_handle, OS_PROBE.as_bytes(), 5).await?;
        let is_windows = probe.contains("Windows_NT");

        // 1b. Execute the appropriate metrics command
        let raw = if is_windows {
            let cmd = build_windows_metrics_command();
            exec_and_read(&ssh_handle, cmd.as_bytes(), 15).await?
        } else {
            exec_and_read(&ssh_handle, METRICS_COMMAND.as_bytes(), 15).await?
        };

        // 3. Split by delimiter
        let sections: Vec<&str> = raw.split(DELIMITER).collect();
        if sections.len() < 7 {
            return Err(SshError::IoError(format!(
                "Expected 7 sections in metrics output, got {}",
                sections.len()
            )));
        }

        // 4. Parse each section — detect OS by marker in section[0]
        let is_macos = sections[0].contains("__MACOS__");
        let is_windows_os = sections[0].contains("__WINDOWS__");

        let (cpu_times, mem_total, mem_free, buffers, cached, swap_total, swap_free,
             load_avg, disk_read_sectors, disk_write_sectors,
             net_rx_bytes, net_tx_bytes, uptime_secs, processes) = if is_windows_os {
            let cpu_times = parse_windows_cpu(sections[0]);
            let (mt, mf, bu, ca, st, sf) = parse_meminfo(sections[1]); // same format
            let la = parse_loadavg(sections[2]); // same "x y z" format
            // Windows reports raw bytes — convert to 512-byte "sectors" so the
            // shared delta math (* 512) produces correct byte rates.
            let (drb, dwb) = parse_windows_disk_net(sections[3], "disk_read_bytes", "disk_write_bytes");
            let (dr, dw) = (drb / 512, dwb / 512);
            let (nr, nt) = parse_windows_disk_net(sections[4], "net_rx_bytes", "net_tx_bytes");
            let up = parse_uptime(sections[5]); // same "secs idle" format
            let procs = parse_windows_processes(sections[6]);
            (cpu_times, mt, mf, bu, ca, st, sf, la, dr, dw, nr, nt, up, procs)
        } else if is_macos {
            let cpu_times = parse_macos_cpu(sections[0]);
            let (mt, mf, bu, ca, st, sf) = parse_macos_mem(sections[1]);
            let la = parse_macos_loadavg(sections[2]);
            let (dr, dw) = parse_macos_diskstats(sections[3]);
            let (nr, nt) = parse_macos_net(sections[4]);
            let up = parse_macos_uptime(sections[5]);
            let procs = parse_macos_processes(sections[6]);
            (cpu_times, mt, mf, bu, ca, st, sf, la, dr, dw, nr, nt, up, procs)
        } else {
            let cpu_times = parse_cpu_stat(sections[0]);
            let (mt, mf, bu, ca, st, sf) = parse_meminfo(sections[1]);
            let la = parse_loadavg(sections[2]);
            let (dr, dw) = parse_diskstats(sections[3]);
            let (nr, nt) = parse_net_dev(sections[4]);
            let up = parse_uptime(sections[5]);
            let procs = parse_processes(sections[6]);
            (cpu_times, mt, mf, bu, ca, st, sf, la, dr, dw, nr, nt, up, procs)
        };

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

// ---------------------------------------------------------------------------
// WSL distro detection
// ---------------------------------------------------------------------------

/// List WSL distributions installed on a remote Windows host.
///
/// Runs `wsl -l -q` over an SSH exec channel and parses the output.
/// Returns an empty Vec if the host is not Windows or has no WSL distros.
#[tauri::command]
pub async fn ssh_list_wsl_distros(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Vec<String>, SshError> {
    AssertSend(async move {
        let ssh_handle = state.ssh_manager.get_ssh_handle(&session_id)?;

        // 1. Probe OS
        let probe = exec_and_read(&ssh_handle, OS_PROBE.as_bytes(), 5).await?;
        if !probe.contains("Windows_NT") {
            return Ok(Vec::new());
        }

        // 2. Run `wsl -l -q` — outputs one distro name per line.
        //    WSL outputs UTF-16LE with BOM, so we handle that.
        let raw = exec_and_read(&ssh_handle, b"wsl -l -q", 10).await?;

        // 3. Parse: strip null bytes (UTF-16LE artifacts), BOM, and empty lines
        let distros: Vec<String> = raw
            .replace('\0', "")
            .replace('\u{feff}', "")
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect();

        Ok(distros)
    })
    .await
}
