---
name: Project Architecture
description: >
  Deep architectural reference for arbeitsamt_vX — Rust backend modules, Tauri IPC command
  inventory, type contracts, and cross-layer relationships. Use this skill whenever working
  on features that span frontend and backend, adding new Tauri commands, debugging IPC issues,
  understanding the SSH/SFTP/tunnel subsystem, exploring the codebase architecture, or when
  any agent needs to understand what modules exist and how they connect. Also triggers on
  "what commands exist?", "how does SSH work?", "backend architecture", "Rust modules",
  "IPC contract", "state management in Rust", "cross-platform metrics", or "zentral module".
version: 1.0.0
---

# Project Architecture - arbeitsamt_vX

## System Overview

Tauri 2 desktop app: Next.js 16 frontend (static export, SSR disabled) communicating with a Rust backend via IPC commands. The app is a server management tool with SSH, SFTP, tunneling, GitHub integration, kanban boards, and workspace management.

```
Frontend (Next.js)  ──tauriInvoke()──>  Tauri IPC  ──>  Rust Commands  ──>  Backend Modules
                    <──Channel<T>────   (streaming)      (state.rs)         (ssh, sftp, pty...)
```

## Rust Backend Module Map

Entry point: `src-tauri/src/lib.rs` registers these modules:

| Module | Files | Purpose |
|--------|-------|---------|
| `error` | `error.rs` | `SshError` enum (10 variants) with Display + From impls |
| `ssh` | `ssh/mod.rs` + 8 sub-modules | SSH connection, auth, terminal, known hosts, config, keepalive, profiles |
| `sftp` | `sftp/mod.rs`, `operations.rs`, `transfer.rs` | SFTP file operations and file transfer with progress |
| `tunnel` | `tunnel/mod.rs`, `local.rs`, `remote.rs` | Local and remote port forwarding |
| `pty` | `pty/mod.rs`, `manager.rs` | Local pseudo-terminal management |
| `commands` | `commands/mod.rs` + 7 sub-modules | Tauri IPC command handlers |
| `state` | `state.rs` | Global `AppState` struct |
| `zentral` | `zentral.rs` | Git repo scanning, cloning, local project import |

## AppState (src-tauri/src/state.rs)

Central shared state using lock-free `DashMap` for concurrent access:

```rust
pub struct AppState {
    pub ssh_manager: SshManager,                              // SSH session registry
    pub transfer_cancels: DashMap<String, CancellationToken>, // SFTP cancel tokens
    pub tunnel_cancels: DashMap<String, CancellationToken>,   // Tunnel cancel tokens
    pub tunnel_infos: DashMap<String, TunnelInfo>,            // Active tunnel metadata
    pub pty_manager: PtyManager,                              // Local terminal processes
    pub metrics_snapshots: DashMap<String, MetricsSnapshot>,  // Server metric deltas
}
```

## SSH Subsystem (src-tauri/src/ssh/)

| File | Key Types/Functions |
|------|-------------------|
| `manager.rs` | `SshManager` (session registry), `ActiveConnection`, `ConnectionInfo`, `TerminalCommand` enum |
| `auth.rs` | `AuthMethod` enum (Password, KeyFile, Agent, Auto), `authenticate()`, `discover_keys()` |
| `handler.rs` | `ClientHandler` (russh Handler impl), `ForwardingTable` type alias |
| `known_hosts.rs` | Host key verification |
| `terminal.rs` | PTY channel setup over SSH |
| `config.rs` | `~/.ssh/config` parsing, `ResolvedSshConfig` |
| `keepalive.rs` | Connection keepalive pings |
| `profiles.rs` | `ConnectionProfile` persistence via Tauri plugin-store |

### SshManager Key Methods

```
register_session() -> String (session_id)
send_data(session_id, data)
resize(session_id, cols, rows)
disconnect(session_id)
reattach_output(session_id, Channel<Vec<u8>>)
get_ssh_handle(session_id) -> Handle
get_sftp_session(session_id) -> SftpSession
list_sessions() -> Vec<ConnectionInfo>
```

### Auth Strategies

The `AuthMethod` enum supports 4 strategies:
- `Password { password }` — plaintext password
- `KeyFile { key_path, passphrase? }` — specific key file
- `Agent` — SSH agent forwarding
- `Auto { identity_file? }` — tries agent first, then discovers keys in `~/.ssh/`

## IPC Command Inventory

### SSH Commands (commands/ssh.rs)

| Command | Args | Returns |
|---------|------|---------|
| `ssh_ping_host` | host, port | `bool` |
| `ssh_connect` | host, port, username, auth_method, cols, rows, output channel | `String` (session_id) |
| `ssh_write` | session_id, data | `()` |
| `ssh_resize` | session_id, cols, rows | `()` |
| `ssh_reattach_output` | session_id, output channel | `()` |
| `ssh_disconnect` | session_id | `()` |
| `ssh_list_sessions` | — | `Vec<ConnectionInfo>` |
| `ssh_exec` | session_id, command | `String` (stdout) |
| `ssh_save_profile` | profile | `()` |
| `ssh_list_profiles` | — | `Vec<ConnectionProfile>` |
| `ssh_delete_profile` | profile_id | `()` |
| `ssh_update_profile` | profile | `()` |
| `ssh_resolve_config` | host | `ResolvedSshConfig` |
| `ssh_list_config_hosts` | — | `Vec<String>` |
| `ssh_discover_keys` | — | `Vec<String>` |
| `ssh_check_agent` | — | `bool` |
| `ssh_list_agent_keys` | — | `Vec<AgentKeyInfo>` |

### SFTP Commands (commands/sftp.rs)

| Command | Args | Returns |
|---------|------|---------|
| `sftp_list_dir` | session_id, path | `Vec<SftpEntry>` |
| `sftp_mkdir` | session_id, path | `()` |
| `sftp_delete` | session_id, path, is_dir | `()` |
| `sftp_rename` | session_id, old_path, new_path | `()` |
| `sftp_stat` | session_id, path | `SftpEntry` |
| `sftp_upload` | session_id, local_path, remote_path, on_progress channel | `String` (transfer_id) |
| `sftp_download` | session_id, remote_path, local_path, on_progress channel | `String` (transfer_id) |
| `sftp_cancel_transfer` | transfer_id | `()` |

### Tunnel Commands (commands/tunnel.rs)

| Command | Args | Returns |
|---------|------|---------|
| `tunnel_local_forward` | session_id, local_port, remote_host, remote_port | `TunnelInfo` |
| `tunnel_stop` | tunnel_id | `()` |
| `tunnel_list` | session_id | `Vec<TunnelInfo>` |
| `tunnel_remote_forward` | session_id, remote_port, local_host, local_port | `RemoteTunnelInfo` |
| `tunnel_stop_remote` | session_id, remote_port | `()` |
| `tunnel_list_remote` | session_id | `Vec<RemoteTunnelInfo>` |

### Dashboard Commands (commands/dashboard.rs)

| Command | Args | Returns |
|---------|------|---------|
| `ssh_get_metrics` | session_id | `ServerMetrics` |

`ServerMetrics` includes: cpu_total_pct, cpu_cores, load_avg, mem (total/used/cached/swap), disk (read/write bps), net (rx/tx bps), processes list, uptime. Cross-platform parser handles both Linux (`/proc/*`) and macOS (`vm_stat`, `iostat`, `netstat`).

### Zentral Commands (src-tauri/src/zentral.rs)

| Command | Args | Returns |
|---------|------|---------|
| `zentral_clone_project` | repo_url, local_path | `()` (emits CloneProgress events) |
| `zentral_import_local_path` | path | `LocalPathInfo` |
| `zentral_scan_repos` | roots, depth | `()` (emits repo + ScanComplete events) |

## Frontend-Backend Type Contracts

### Settings (lib/settings.ts)

```typescript
interface AppSettings {
  theme: Theme                    // "light" | "dark" | "system"
  terminal: TerminalSettings      // fontSize, cursorStyle, cursorBlink, scrollback, colorPreset
  sshProfiles: SshProfile[]       // {id, name, host, port, username, authMethod, colorTag}
  checkUpdatesOnLaunch: boolean
  apiTokens: ApiToken[]           // {id, key, value, description, isCustom}
}
```

Persisted via `@tauri-apps/plugin-store` (LazyStore with `settings.json`).

### GitHub Types (lib/github.ts)

Core interfaces: `GithubUser`, `GithubRepo`, `GithubOrg`, `GithubOrgMember`, `GithubEvent`, `GithubReadme`, `GithubCommit`, `GithubIssue`, `GithubPR`, `GithubContributor`.

Error handling: `GithubError` class with `GithubErrorKind` (unauthorized, forbidden, not_found, rate_limited, server_error, network_error, unknown).

API calls go through `fetchGithub()` which uses `tauriFetch` (Tauri native HTTP to avoid CORS).

### Kanban (lib/kanban/)

Full local kanban system: `schemas.ts` (Zod validation), `types.ts`, `store.ts` (Tauri plugin-store persistence), `reducer.ts` (state updates), `migrations.ts` (schema evolution), `attachments.ts` (file handling).

### Navigation (components/layout/nav-main.tsx)

Two nav groups (`mainNavItems`, `othersNavItems`) with nested `NavItem[]` supporting sub-items. Routes match `app/(dashboard)/*` pages.

## Key Architecture Patterns

1. **DashMap over Arc<Mutex<HashMap>>** — lock-free concurrent maps for session/tunnel/transfer state
2. **Channel<T> streaming** — Tauri 2 IPC channels for real-time data (terminal output, transfer progress, clone progress)
3. **AssertSend wrapper** — manually asserts Send on russh async futures for Tauri command compatibility
4. **Delta-based metrics** — MetricsSnapshot stores raw counters; CPU%/bps computed from deltas between polls
5. **Dynamic imports for Tauri** — `lib/tauri.ts` lazy-loads `@tauri-apps/api` to avoid SSR/build failures
6. **Plugin-store persistence** — settings, kanban, profiles all use `@tauri-apps/plugin-store` with JSON serialization
7. **Cross-platform parsing** — dashboard metrics parse both Linux /proc and macOS system commands (runs remotely via ssh_exec)

## File Ownership Boundaries

| Domain | Rust Files | Frontend Files |
|--------|-----------|----------------|
| SSH | `ssh/*`, `commands/ssh.rs` | `hooks/useSSHSession.ts`, `components/dashboard/ssh/` |
| SFTP | `sftp/*`, `commands/sftp.rs` | `components/dashboard/sftp/` |
| Tunnels | `tunnel/*`, `commands/tunnel.rs` | (within server detail page) |
| Metrics | `commands/dashboard.rs` | `app/(dashboard)/servers/detail/` |
| GitHub | `commands/github.rs` | `lib/github.ts`, `hooks/useGithub.ts`, `components/dashboard/github/` |
| Kanban | — | `lib/kanban/`, `context/KanbanContext.tsx`, `components/dashboard/kanban/` |
| Zentral | `zentral.rs` | `lib/zentral/`, `context/ZentralContext.tsx`, `components/dashboard/zentral/` |
| Settings | — (plugin-store) | `lib/settings.ts`, `context/settings-context.tsx`, `components/dashboard/settings/` |
| Chat | — | `lib/chat/`, `context/ChatContext.tsx`, `components/dashboard/chat/` |
