use dashmap::DashMap;
use tokio_util::sync::CancellationToken;

use crate::commands::dashboard::MetricsSnapshot;
use crate::pty::manager::PtyManager;
use crate::ssh::manager::SshManager;
use crate::tunnel::local::TunnelInfo;

pub struct AppState {
    pub ssh_manager: SshManager,
    /// Active transfer cancellation tokens, keyed by transfer_id.
    pub transfer_cancels: DashMap<String, CancellationToken>,
    /// Active tunnel cancellation tokens, keyed by tunnel_id.
    pub tunnel_cancels: DashMap<String, CancellationToken>,
    /// Active tunnel metadata, keyed by tunnel_id.
    pub tunnel_infos: DashMap<String, TunnelInfo>,
    /// Local PTY session manager.
    pub pty_manager: PtyManager,
    /// Previous metrics snapshots for delta computation, keyed by session_id.
    pub metrics_snapshots: DashMap<String, MetricsSnapshot>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            ssh_manager: SshManager::new(),
            transfer_cancels: DashMap::new(),
            tunnel_cancels: DashMap::new(),
            tunnel_infos: DashMap::new(),
            pty_manager: PtyManager::new(),
            metrics_snapshots: DashMap::new(),
        }
    }
}
