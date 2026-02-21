use tauri::Manager;

#[cfg(desktop)]
use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
#[cfg(desktop)]
use tauri::Emitter;

mod error;
mod ssh;
mod sftp;
mod tunnel;
mod pty;
mod commands;
mod state;
mod zentral;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env from the project root (one level up from src-tauri/).
    // During `tauri dev`, CWD is often src-tauri/, so we resolve the
    // parent directory to find the .env file at the project root.
    let env_path = std::env::current_dir()
        .map(|cwd| {
            let candidate = cwd.join(".env");
            if candidate.exists() {
                candidate
            } else {
                // CWD is likely src-tauri/ — go up one level
                cwd.parent()
                    .map(|p| p.join(".env"))
                    .unwrap_or(candidate)
            }
        })
        .unwrap_or_else(|_| std::path::PathBuf::from(".env"));
    let _ = dotenvy::from_path(&env_path);

    tauri::Builder::default()
        .setup(|app| {
            // === Desktop-only plugins (registered via setup) ===

            // Single Instance — MUST be first plugin registered
            #[cfg(desktop)]
            app.handle().plugin(
                tauri_plugin_single_instance::init(|app, _args, _cwd| {
                    let _ = app
                        .get_webview_window("main")
                        .expect("no main window")
                        .set_focus();
                }),
            )?;

            // Window State — remembers position/size across sessions
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_window_state::Builder::default().build())?;

            // Global Shortcut — system-wide keyboard shortcuts
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_global_shortcut::Builder::new().build())?;

            // Autostart — launch at system startup
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                None,
            ))?;

            // CLI — command-line argument parsing
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_cli::init())?;

            // Positioner — window positioning presets
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_positioner::init())?;

            // Updater — requires pubkey + endpoints in tauri.conf.json plugins.updater
            // Uncomment after running `tauri signer generate` and configuring endpoints:
            // app.handle()
            //     .plugin(tauri_plugin_updater::Builder::new().build())?;

            // === Native Menu ===
            #[cfg(desktop)]
            {
                let file_menu = SubmenuBuilder::new(app, "File")
                    .item(&MenuItemBuilder::with_id("new-window", "New Window").build(app)?)
                    .separator()
                    .quit()
                    .build()?;

                let edit_menu = SubmenuBuilder::new(app, "Edit")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste()
                    .select_all()
                    .build()?;

                let view_menu = SubmenuBuilder::new(app, "View")
                    .item(
                        &MenuItemBuilder::with_id("zoom-in", "Zoom In")
                            .accelerator("CmdOrCtrl+=")
                            .build(app)?,
                    )
                    .item(
                        &MenuItemBuilder::with_id("zoom-out", "Zoom Out")
                            .accelerator("CmdOrCtrl+-")
                            .build(app)?,
                    )
                    .item(
                        &MenuItemBuilder::with_id("zoom-reset", "Reset Zoom")
                            .accelerator("CmdOrCtrl+0")
                            .build(app)?,
                    )
                    .separator()
                    .item(
                        &MenuItemBuilder::with_id("fullscreen", "Toggle Fullscreen")
                            .accelerator("F11")
                            .build(app)?,
                    )
                    .build()?;

                let navigate_menu = SubmenuBuilder::new(app, "Navigate")
                    .item(
                        &MenuItemBuilder::with_id("nav-dashboard", "Dashboard")
                            .accelerator("CmdOrCtrl+1")
                            .build(app)?,
                    )
                    .item(
                        &MenuItemBuilder::with_id("nav-ssh", "SSH Terminal")
                            .accelerator("CmdOrCtrl+2")
                            .build(app)?,
                    )
                    .item(
                        &MenuItemBuilder::with_id("nav-github", "GitHub")
                            .accelerator("CmdOrCtrl+3")
                            .build(app)?,
                    )
                    .item(
                        &MenuItemBuilder::with_id("nav-kanban", "Kanban")
                            .accelerator("CmdOrCtrl+4")
                            .build(app)?,
                    )
                    .separator()
                    .item(
                        &MenuItemBuilder::with_id("nav-settings", "Settings")
                            .accelerator("CmdOrCtrl+,")
                            .build(app)?,
                    )
                    .build()?;

                let tools_menu = SubmenuBuilder::new(app, "Tools")
                    .item(
                        &MenuItemBuilder::with_id("new-ssh", "New SSH Connection")
                            .accelerator("CmdOrCtrl+N")
                            .build(app)?,
                    )
                    .item(
                        &MenuItemBuilder::with_id("toggle-theme", "Toggle Theme")
                            .accelerator("CmdOrCtrl+T")
                            .build(app)?,
                    )
                    .build()?;

                let help_menu = SubmenuBuilder::new(app, "Help")
                    .about(Some(AboutMetadata {
                        name: Some("arbeitsamt".to_string()),
                        ..Default::default()
                    }))
                    .build()?;

                let menu = MenuBuilder::new(app)
                    .items(&[
                        &file_menu,
                        &edit_menu,
                        &view_menu,
                        &navigate_menu,
                        &tools_menu,
                        &help_menu,
                    ])
                    .build()?;

                app.set_menu(menu)?;

                app.on_menu_event(move |app_handle, event| {
                    let id = event.id().0.as_str();
                    match id {
                        // Navigation events — emitted to frontend for client-side routing
                        "nav-dashboard" | "nav-ssh" | "nav-github" | "nav-kanban"
                        | "nav-settings" => {
                            let _ = app_handle.emit("menu-navigate", id);
                        }
                        // Tools
                        "new-ssh" => {
                            let _ = app_handle.emit("menu-action", "new-ssh");
                        }
                        "toggle-theme" => {
                            let _ = app_handle.emit("menu-action", "toggle-theme");
                        }
                        // View controls
                        "zoom-in" | "zoom-out" | "zoom-reset" | "fullscreen" => {
                            let _ = app_handle.emit("menu-action", id);
                        }
                        // New window
                        "new-window" => {
                            let _ = app_handle.emit("menu-action", "new-window");
                        }
                        _ => {}
                    }
                });
            }

            // Show the main window (starts hidden to avoid flash while window-state restores)
            let main_window = app.get_webview_window("main").expect("no main window");
            main_window.show().unwrap();

            Ok(())
        })
        // === Cross-platform plugins ===
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .level_for("russh", log::LevelFilter::Warn)
                .level_for("russh_keys", log::LevelFilter::Warn)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_websocket::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_localhost::Builder::new(9527).build())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .manage(state::AppState::new())
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::ssh::ssh_ping_host,
            commands::ssh::ssh_connect,
            commands::ssh::ssh_write,
            commands::ssh::ssh_resize,
            commands::ssh::ssh_reattach_output,
            commands::ssh::ssh_disconnect,
            commands::ssh::ssh_list_sessions,
            commands::ssh::ssh_save_profile,
            commands::ssh::ssh_list_profiles,
            commands::ssh::ssh_delete_profile,
            commands::ssh::ssh_update_profile,
            commands::ssh::ssh_resolve_config,
            commands::ssh::ssh_list_config_hosts,
            commands::ssh::ssh_discover_keys,
            commands::ssh::ssh_check_agent,
            commands::ssh::ssh_list_agent_keys,
            commands::ssh::ssh_exec,
            commands::sftp::sftp_list_dir,
            commands::sftp::sftp_mkdir,
            commands::sftp::sftp_delete,
            commands::sftp::sftp_rename,
            commands::sftp::sftp_stat,
            commands::sftp::sftp_upload,
            commands::sftp::sftp_download,
            commands::sftp::sftp_cancel_transfer,
            commands::tunnel::tunnel_local_forward,
            commands::tunnel::tunnel_stop,
            commands::tunnel::tunnel_list,
            commands::tunnel::tunnel_remote_forward,
            commands::tunnel::tunnel_stop_remote,
            commands::tunnel::tunnel_list_remote,
            commands::pty::pty_spawn,
            commands::pty::pty_write,
            commands::pty::pty_resize,
            commands::pty::pty_close,
            commands::github::get_github_token,
            commands::dashboard::ssh_get_metrics,
            commands::docker::ssh_docker_data,
            commands::docker::ssh_docker_logs,
            zentral::zentral_clone_project,
            zentral::zentral_import_local_path,
            zentral::zentral_scan_repos,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
