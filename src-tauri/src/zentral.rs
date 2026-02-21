use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::time::Instant;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
struct CloneProgress {
    line: String,
}

#[derive(Clone, Serialize)]
struct CloneComplete {
    path: String,
}

/// Clone a git repository to a local path, streaming progress events.
///
/// Emits:
/// - `zentral://clone-progress` with `{ line: String }` for each output line
/// - `zentral://clone-complete` with `{ path: String }` on success
///
/// Returns an error string on failure.
#[tauri::command]
pub fn zentral_clone_project(
    app: AppHandle,
    repo_url: String,
    local_path: String,
) -> Result<(), String> {
    // Validate local_path doesn't already exist
    if Path::new(&local_path).exists() {
        return Err(format!("Destination path already exists: {local_path}"));
    }

    // Spawn git clone with --progress (writes progress to stderr)
    let mut child = std::process::Command::new("git")
        .args(["clone", "--progress", &repo_url, &local_path])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "git is not installed or not in PATH".to_string()
            } else {
                format!("Failed to spawn git: {e}")
            }
        })?;

    // Collect stderr in a thread to stream progress lines
    let stderr = child.stderr.take().expect("stderr piped");
    let app_clone = app.clone();
    let stderr_thread = std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        let mut lines = Vec::new();
        for line in reader.lines() {
            if let Ok(line) = line {
                lines.push(line.clone());
                let _ = app_clone.emit("zentral://clone-progress", CloneProgress { line });
            }
        }
        lines
    });

    // Also drain stdout (usually empty for git clone)
    let stdout = child.stdout.take().expect("stdout piped");
    let app_stdout = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().flatten() {
            let _ = app_stdout.emit("zentral://clone-progress", CloneProgress { line });
        }
    });

    let status = child.wait().map_err(|e| format!("Failed to wait on git: {e}"))?;
    let stderr_lines = stderr_thread.join().unwrap_or_default();

    if !status.success() {
        return Err(stderr_lines.join("\n"));
    }

    // Derive repo name from URL (last path segment, strip .git suffix)
    let repo_name = repo_url
        .trim_end_matches('/')
        .rsplit('/')
        .next()
        .unwrap_or("unknown")
        .trim_end_matches(".git")
        .to_string();

    // Write stub .zentral.json
    let zentral_json = format!(
        r#"{{ "version": "1", "name": "{repo_name}" }}"#
    );
    let zentral_path = Path::new(&local_path).join(".zentral.json");
    std::fs::write(&zentral_path, zentral_json)
        .map_err(|e| format!("Failed to write .zentral.json: {e}"))?;

    // Emit completion event
    let _ = app.emit("zentral://clone-complete", CloneComplete { path: local_path });

    Ok(())
}

// ─── Import Local Path ────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct LocalPathInfo {
    pub path: String,
    pub name: String,
    pub remote_url: Option<String>,
    pub repo_full_name: Option<String>,
    pub has_zentral_config: bool,
    pub zentral_config: Option<serde_json::Value>,
}

/// Import a local git repository, extracting metadata without cloning.
///
/// Validates the path is a git repo (`.git/` dir or `.git` file for worktrees),
/// extracts the origin remote URL and normalizes it, and reads `.zentral.json` if present.
#[tauri::command]
pub fn zentral_import_local_path(path: String) -> Result<LocalPathInfo, String> {
    let base = Path::new(&path);

    if !base.exists() {
        return Err(format!("Path does not exist: {path}"));
    }

    // Resolve the actual git directory (supports worktrees via `.git` file)
    let git_entry = base.join(".git");
    if !git_entry.exists() {
        return Err(format!("Not a git repository: {path}"));
    }

    let git_dir = if git_entry.is_dir() {
        git_entry
    } else {
        // `.git` is a file → worktree: read `gitdir: <path>`
        let content = std::fs::read_to_string(&git_entry)
            .map_err(|e| format!("Failed to read .git file: {e}"))?;
        let resolved = content
            .lines()
            .find_map(|line| line.strip_prefix("gitdir:").map(str::trim).map(str::to_string))
            .ok_or_else(|| "Malformed .git file: missing 'gitdir:' line".to_string())?;
        // The path in gitdir may be relative to the repo root
        let resolved_path = Path::new(&resolved);
        if resolved_path.is_absolute() {
            resolved_path.to_path_buf()
        } else {
            base.join(resolved_path)
        }
    };

    // Extract remote origin URL from .git/config
    let remote_url = parse_remote_origin(&git_dir)?;
    let normalized_url = remote_url.as_deref().map(normalize_git_url);
    let repo_full_name = normalized_url.as_deref().and_then(extract_full_name);

    // Derive repo name: last path segment of the base path
    let name = base
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    // Read .zentral.json if present
    let zentral_path = base.join(".zentral.json");
    let (has_zentral_config, zentral_config) = if zentral_path.exists() {
        let raw = std::fs::read_to_string(&zentral_path)
            .map_err(|e| format!("Failed to read .zentral.json: {e}"))?;
        let parsed: serde_json::Value = serde_json::from_str(&raw)
            .map_err(|e| format!("Invalid .zentral.json: {e}"))?;
        (true, Some(parsed))
    } else {
        (false, None)
    };

    // Canonical absolute path
    let abs_path = base
        .canonicalize()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or(path);

    Ok(LocalPathInfo {
        path: abs_path,
        name,
        remote_url: normalized_url,
        repo_full_name,
        has_zentral_config,
        zentral_config,
    })
}

/// Parse `[remote "origin"]` → `url = <value>` from `.git/config`.
fn parse_remote_origin(git_dir: &Path) -> Result<Option<String>, String> {
    let config_path = git_dir.join("config");
    if !config_path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read .git/config: {e}"))?;

    let mut in_origin = false;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == r#"[remote "origin"]"# {
            in_origin = true;
            continue;
        }
        if in_origin {
            if trimmed.starts_with('[') {
                break; // next section
            }
            if let Some(rest) = trimmed.strip_prefix("url") {
                if let Some(url) = rest.trim().strip_prefix('=') {
                    return Ok(Some(url.trim().to_string()));
                }
            }
        }
    }
    Ok(None)
}

/// Normalize a git remote URL to HTTPS format, stripping trailing `.git`.
///
/// Handles:
/// - `git@github.com:owner/repo.git` → `https://github.com/owner/repo`
/// - `https://github.com/owner/repo.git` → `https://github.com/owner/repo`
fn normalize_git_url(url: &str) -> String {
    let url = url.trim_end_matches(".git");

    // SSH format: git@host:path
    if let Some(rest) = url.strip_prefix("git@") {
        if let Some(colon) = rest.find(':') {
            let host = &rest[..colon];
            let path = &rest[colon + 1..];
            return format!("https://{host}/{path}");
        }
    }

    url.to_string()
}

/// Extract `owner/repo` from a normalized HTTPS URL.
fn extract_full_name(url: &str) -> Option<String> {
    // Expect https://host/owner/repo
    let after_scheme = url.strip_prefix("https://").or_else(|| url.strip_prefix("http://"))?;
    let slash = after_scheme.find('/')?;
    let path = &after_scheme[slash + 1..];
    if path.is_empty() {
        return None;
    }
    Some(path.to_string())
}

// ─── Scan Repos ───────────────────────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
pub struct RepoInfo {
    pub path: String,
    pub name: String,
    pub remote_url: Option<String>,
    pub has_zentral_config: bool,
    pub is_worktree: bool,
    pub worktree_parent: Option<String>,
}

#[derive(Serialize, Clone)]
struct ScanCompletePayload {
    total: usize,
    elapsed_ms: u64,
}

/// Check if `dir` is a git repo. Returns `(is_repo, is_worktree, worktree_parent)`.
fn detect_git(dir: &Path) -> (bool, bool, Option<String>) {
    let git_entry = dir.join(".git");

    if git_entry.is_dir() {
        return (true, false, None);
    }

    if git_entry.is_file() {
        // git worktree — read file to resolve parent gitdir
        let content = std::fs::read_to_string(&git_entry).unwrap_or_default();
        let parent = content
            .lines()
            .find(|l| l.starts_with("gitdir:"))
            .map(|l| l["gitdir:".len()..].trim().to_string());
        return (true, true, parent);
    }

    (false, false, None)
}

/// Parse remote URL from a `.git/config` file under `[remote "origin"]`.
fn parse_scan_remote_url(git_config_path: &Path) -> Option<String> {
    let content = std::fs::read_to_string(git_config_path).ok()?;
    let mut in_origin = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == r#"[remote "origin"]"# {
            in_origin = true;
            continue;
        }
        if trimmed.starts_with('[') {
            in_origin = false;
            continue;
        }
        if in_origin {
            if let Some(rest) = trimmed.strip_prefix("url") {
                if let Some(url) = rest.trim().strip_prefix('=') {
                    return Some(url.trim().to_string());
                }
            }
        }
    }
    None
}

fn build_repo_info(dir: &Path, is_worktree: bool, worktree_parent: Option<String>) -> RepoInfo {
    let path = dir.to_string_lossy().to_string();
    let name = dir
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    let remote_url = parse_scan_remote_url(&dir.join(".git").join("config"));
    let has_zentral_config = dir.join(".zentral.json").exists();

    RepoInfo {
        path,
        name,
        remote_url,
        has_zentral_config,
        is_worktree,
        worktree_parent,
    }
}

fn walk_for_repos(dir: &Path, depth: u8, results: &mut Vec<RepoInfo>) {
    if depth == 0 {
        return;
    }

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return, // skip unreadable dirs gracefully
    };

    for entry in entries.flatten() {
        let path = entry.path();

        if !path.is_dir() {
            continue;
        }

        let entry_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");

        // Skip hidden directories (e.g. .git, .DS_Store) — they're not repos themselves
        if entry_name.starts_with('.') {
            continue;
        }

        let (is_repo, is_worktree, worktree_parent) = detect_git(&path);

        if is_repo {
            results.push(build_repo_info(&path, is_worktree, worktree_parent));
            // Don't recurse into git repos
        } else {
            walk_for_repos(&path, depth - 1, results);
        }
    }
}

/// Scan root directories for git repositories up to `depth` levels deep.
///
/// Results are streamed via Tauri events:
/// - `zentral://scan-result` — one `RepoInfo` per found repo
/// - `zentral://scan-complete` — `{ total, elapsed_ms }` when done
/// - `zentral://scan-slow-warning` — emitted if scan exceeds 5 seconds
#[tauri::command]
pub async fn zentral_scan_repos(
    app: AppHandle,
    roots: Vec<String>,
    depth: u8,
) -> Result<(), String> {
    tokio::spawn(async move {
        let start = Instant::now();
        let mut total = 0usize;
        let mut slow_warned = false;

        for root in &roots {
            let root_path = PathBuf::from(root);
            let mut batch = Vec::new();
            walk_for_repos(&root_path, depth, &mut batch);

            for repo in batch {
                let _ = app.emit("zentral://scan-result", &repo);
                total += 1;

                if !slow_warned && start.elapsed().as_secs() > 5 {
                    slow_warned = true;
                    let _ = app.emit(
                        "zentral://scan-slow-warning",
                        format!("Scan exceeded 5 seconds ({total} repos found so far)"),
                    );
                }
            }
        }

        let elapsed_ms = start.elapsed().as_millis() as u64;
        let _ = app.emit(
            "zentral://scan-complete",
            ScanCompletePayload { total, elapsed_ms },
        );
    });

    Ok(())
}
