use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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

            // Show the main window (starts hidden to avoid flash while window-state restores)
            let main_window = app.get_webview_window("main").expect("no main window");
            main_window.show().unwrap();

            Ok(())
        })
        // === Cross-platform plugins ===
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_log::Builder::new().build())
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
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
