// GitHub-related Tauri commands

/// Return the `GITHUB_TOKEN` environment variable to the frontend.
///
/// The token is read from the process environment at call time so the
/// raw value never lands in the JS bundle.
#[tauri::command]
pub fn get_github_token() -> Result<String, String> {
    std::env::var("GITHUB_TOKEN")
        .map_err(|_| "GITHUB_TOKEN environment variable is not set".to_string())
}
