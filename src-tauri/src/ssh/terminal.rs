use std::io::Cursor;

use russh::{ChannelMsg, ChannelReadHalf, ChannelWriteHalf};
use tauri::ipc::Channel;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use crate::ssh::manager::TerminalCommand;

/// The terminal actor runs in a tokio task and bridges russh channel I/O
/// with the frontend via Tauri `Channel<Vec<u8>>` (for output) and
/// `mpsc::UnboundedReceiver<TerminalCommand>` (for input commands).
///
/// Lifecycle: spawned by `SshManager` after opening a session channel,
/// runs until the SSH channel closes, the cancellation token fires, or
/// the command receiver is dropped.
///
/// Accepts split channel halves so that the caller can use the write half
/// for PTY / shell setup before handing it over (avoiding `&Channel` borrows
/// across `.await` in `#[tauri::command]` futures, which fail Send checks).
pub struct TerminalActor<S: From<(russh::ChannelId, ChannelMsg)> + Send + Sync + 'static> {
    read_half: ChannelReadHalf,
    write_half: ChannelWriteHalf<S>,
    cmd_rx: mpsc::UnboundedReceiver<TerminalCommand>,
    output: Channel<Vec<u8>>,
    session_id: String,
    cancel: CancellationToken,
}

impl<S: From<(russh::ChannelId, ChannelMsg)> + Send + Sync + 'static> TerminalActor<S> {
    pub fn new(
        read_half: ChannelReadHalf,
        write_half: ChannelWriteHalf<S>,
        cmd_rx: mpsc::UnboundedReceiver<TerminalCommand>,
        output: Channel<Vec<u8>>,
        session_id: String,
        cancel: CancellationToken,
    ) -> Self {
        Self {
            read_half,
            write_half,
            cmd_rx,
            output,
            session_id,
            cancel,
        }
    }

    /// Run the bidirectional I/O loop.
    ///
    /// Uses `biased` `tokio::select!` so cancellation is always checked first,
    /// followed by server-to-frontend output, then frontend-to-server input.
    ///
    /// This method consumes `self` and runs until one of:
    /// - The cancellation token is triggered
    /// - The SSH channel sends EOF, ExitStatus, Close, or drops
    /// - The command receiver is dropped (SshManager disconnected)
    /// - A write error occurs on the SSH channel
    pub async fn run(mut self) {
        loop {
            tokio::select! {
                biased;

                // Highest priority: cancellation
                _ = self.cancel.cancelled() => {
                    log::info!("TerminalActor {}: cancelled", self.session_id);
                    let _ = self.write_half.close().await;
                    break;
                }

                // Server -> Frontend: channel messages
                msg = self.read_half.wait() => {
                    match msg {
                        Some(ChannelMsg::Data { data }) => {
                            let _ = self.output.send(data.to_vec());
                        }
                        Some(ChannelMsg::ExtendedData { data, .. }) => {
                            // stderr -- also forward to the terminal
                            let _ = self.output.send(data.to_vec());
                        }
                        Some(ChannelMsg::ExitStatus { exit_status }) => {
                            log::info!(
                                "TerminalActor {}: exit status {}",
                                self.session_id, exit_status
                            );
                            break;
                        }
                        Some(ChannelMsg::Eof) => {
                            log::info!("TerminalActor {}: EOF", self.session_id);
                            break;
                        }
                        None => {
                            log::info!(
                                "TerminalActor {}: channel closed",
                                self.session_id
                            );
                            break;
                        }
                        _ => {
                            // WindowAdjusted, Success, Failure, etc. -- ignore
                        }
                    }
                }

                // Frontend -> Server: user input commands
                cmd = self.cmd_rx.recv() => {
                    match cmd {
                        Some(TerminalCommand::Data(data)) => {
                            if let Err(e) = self.write_half.data(Cursor::new(data)).await {
                                log::error!(
                                    "TerminalActor {}: write error: {}",
                                    self.session_id, e
                                );
                                break;
                            }
                        }
                        Some(TerminalCommand::Resize { cols, rows }) => {
                            if let Err(e) = self.write_half.window_change(
                                cols as u32, rows as u32, 0, 0,
                            ).await {
                                log::warn!(
                                    "TerminalActor {}: resize error: {}",
                                    self.session_id, e
                                );
                            }
                        }
                        Some(TerminalCommand::Close) => {
                            let _ = self.write_half.close().await;
                            break;
                        }
                        None => {
                            // cmd_rx dropped -- SshManager disconnected
                            log::info!(
                                "TerminalActor {}: command channel dropped",
                                self.session_id
                            );
                            break;
                        }
                    }
                }
            }
        }

        log::info!("TerminalActor {}: loop exited", self.session_id);
    }
}
