use std::time::Duration;

/// Default interval between SSH keepalive probes (seconds).
/// If no data is received from the server within this period,
/// russh sends a `keepalive@openssh.com` global request.
pub const DEFAULT_KEEPALIVE_INTERVAL_SECS: u64 = 15;

/// Default maximum number of unanswered keepalive probes before
/// russh considers the connection dead and returns `KeepaliveTimeout`.
pub const DEFAULT_KEEPALIVE_MAX: usize = 3;

/// Build the keepalive interval duration from seconds.
/// Returns `None` if `secs` is 0 (disables keepalive).
pub fn keepalive_interval(secs: u64) -> Option<Duration> {
    if secs == 0 {
        None
    } else {
        Some(Duration::from_secs(secs))
    }
}
