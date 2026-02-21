use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::mpsc as std_mpsc;
use std::sync::Mutex;

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use tauri::{AppHandle, Emitter};
use tokio_util::sync::CancellationToken;

use crate::error::SshError;

/// A single active PTY session.
///
/// The writer and master are wrapped in `Mutex` because `Box<dyn Write + Send>`
/// and `Box<dyn MasterPty + Send>` are not `Sync`, but Tauri's managed state
/// requires `Sync`.
struct PtySession {
    writer: Mutex<Box<dyn Write + Send>>,
    master: Mutex<Box<dyn MasterPty + Send>>,
    child: Mutex<Box<dyn Child + Send + Sync>>,
    cancel: CancellationToken,
}

/// Manages all active local PTY sessions.
///
/// Uses `Mutex<HashMap>` instead of `DashMap` because `PtySession` contains
/// non-`Sync` fields that can't satisfy `DashMap`'s bounds.
pub struct PtyManager {
    sessions: Mutex<HashMap<String, PtySession>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    /// Spawn a new local shell PTY session.
    ///
    /// The reader runs on a dedicated `std::thread` (portable-pty reads are
    /// blocking and long-lived, so they must NOT live on the tokio thread pool).
    /// Data is bridged to the async world via `std::sync::mpsc` -> tokio task
    /// that emits Tauri events.
    pub fn spawn_pty(
        &self,
        app: AppHandle,
        id: String,
        cols: u16,
        rows: u16,
    ) -> Result<(), SshError> {
        {
            let sessions = self.sessions.lock().unwrap();
            if sessions.contains_key(&id) {
                return Err(SshError::IoError(format!(
                    "PTY session already exists: {id}"
                )));
            }
        }

        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        // Open the PTY pair.
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(size)
            .map_err(|e| SshError::IoError(format!("Failed to open PTY: {e}")))?;

        // Build the shell command.
        let shell = detect_shell();
        let mut cmd = CommandBuilder::new(&shell);
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        // Spawn the child process on the slave side.
        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| SshError::IoError(format!("Failed to spawn shell '{shell}': {e}")))?;

        // Get reader from master (consumes the reader capability).
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| SshError::IoError(format!("Failed to clone PTY reader: {e}")))?;

        let cancel = CancellationToken::new();
        let cancel_clone = cancel.clone();
        let event_name = format!("pty-data-{id}");

        // Bridge channel: std::thread reader -> tokio task -> Tauri event.
        let (tx, rx) = std_mpsc::channel::<Vec<u8>>();

        // Dedicated OS thread for blocking PTY reads.
        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                if cancel_clone.is_cancelled() {
                    break;
                }
                match reader.read(&mut buf) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        if tx.send(buf[..n].to_vec()).is_err() {
                            break; // receiver dropped
                        }
                    }
                    Err(_) => break,
                }
            }
        });

        // Tokio task that receives data from the reader thread and emits Tauri events.
        let event_app = app.clone();
        tokio::spawn(async move {
            loop {
                match rx.try_recv() {
                    Ok(data) => {
                        let _ = event_app.emit(&event_name, data);
                    }
                    Err(std_mpsc::TryRecvError::Empty) => {
                        tokio::time::sleep(std::time::Duration::from_millis(5)).await;
                    }
                    Err(std_mpsc::TryRecvError::Disconnected) => break,
                }
            }
        });

        // Store the session. The master is kept for resize; writing goes through
        // the master directly (portable-pty 0.8 doesn't have try_clone_writer,
        // so we write via the master's Write impl).
        let session = PtySession {
            writer: Mutex::new(pair.master.take_writer()
                .map_err(|e| SshError::IoError(format!("Failed to take PTY writer: {e}")))?),
            master: Mutex::new(pair.master),
            child: Mutex::new(child),
            cancel,
        };

        self.sessions.lock().unwrap().insert(id, session);

        Ok(())
    }

    /// Write raw bytes (user keystrokes) to a PTY session.
    pub fn write_pty(&self, id: &str, data: &[u8]) -> Result<(), SshError> {
        let sessions = self.sessions.lock().unwrap();
        let session = sessions
            .get(id)
            .ok_or_else(|| SshError::SessionNotFound(format!("PTY session not found: {id}")))?;

        let mut writer = session.writer.lock().unwrap();
        writer
            .write_all(data)
            .map_err(|e| SshError::IoError(format!("PTY write error: {e}")))?;
        writer
            .flush()
            .map_err(|e| SshError::IoError(format!("PTY flush error: {e}")))?;
        Ok(())
    }

    /// Resize a PTY session.
    pub fn resize_pty(&self, id: &str, cols: u16, rows: u16) -> Result<(), SshError> {
        let sessions = self.sessions.lock().unwrap();
        let session = sessions
            .get(id)
            .ok_or_else(|| SshError::SessionNotFound(format!("PTY session not found: {id}")))?;

        let master = session.master.lock().unwrap();
        master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| SshError::IoError(format!("PTY resize error: {e}")))?;
        Ok(())
    }

    /// Close a PTY session: cancel the reader, kill the child, drop the writer.
    pub fn close_pty(&self, id: &str) -> Result<(), SshError> {
        let session = self
            .sessions
            .lock()
            .unwrap()
            .remove(id)
            .ok_or_else(|| SshError::SessionNotFound(format!("PTY session not found: {id}")))?;

        // Signal the reader thread to stop.
        session.cancel.cancel();

        // Kill the child process (best-effort).
        let mut child = session.child.lock().unwrap();
        let _ = child.kill();

        // Writer and master are dropped automatically.
        Ok(())
    }
}

/// Detect the default shell for the current platform.
fn detect_shell() -> String {
    #[cfg(target_os = "windows")]
    {
        // Prefer PowerShell 7 (pwsh.exe), fall back to Windows PowerShell 5.1.
        if which_exists("pwsh.exe") {
            "pwsh.exe".to_string()
        } else {
            "powershell.exe".to_string()
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
    }
}

/// Check if a command exists on the system PATH (Windows helper).
#[cfg(target_os = "windows")]
fn which_exists(name: &str) -> bool {
    use std::process::Command;
    Command::new("where")
        .arg(name)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}
