// Cloud account Tauri commands — CRUD + profile discovery + manual credentials

use serde_json::json;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::cloud::aws;
use crate::cloud::error::CloudError;
use crate::cloud::types::*;

const CLOUD_STORE: &str = "cloud-accounts.json";
const ACCOUNTS_KEY: &str = "accounts";

// ---------------------------------------------------------------------------
// Store helpers (matches ssh.rs pattern)
// ---------------------------------------------------------------------------

fn load_accounts(app: &AppHandle) -> Result<Vec<CloudAccount>, CloudError> {
    let store = app
        .store(CLOUD_STORE)
        .map_err(|e| CloudError::StoreError(format!("Failed to open cloud store: {e}")))?;

    match store.get(ACCOUNTS_KEY) {
        Some(value) => serde_json::from_value(value)
            .map_err(|e| CloudError::StoreError(format!("Failed to parse accounts: {e}"))),
        None => Ok(Vec::new()),
    }
}

fn save_accounts(app: &AppHandle, accounts: &[CloudAccount]) -> Result<(), CloudError> {
    let store = app
        .store(CLOUD_STORE)
        .map_err(|e| CloudError::StoreError(format!("Failed to open cloud store: {e}")))?;

    store.set(ACCOUNTS_KEY.to_string(), json!(accounts));

    store
        .save()
        .map_err(|e| CloudError::StoreError(format!("Failed to save cloud store: {e}")))?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Profile discovery
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn cloud_list_aws_profiles() -> Result<Vec<String>, CloudError> {
    Ok(aws::list_aws_profiles())
}

// ---------------------------------------------------------------------------
// Account CRUD
// ---------------------------------------------------------------------------

/// Import an account from an existing AWS CLI profile.
#[tauri::command]
pub async fn cloud_add_account(
    app: AppHandle,
    profile_name: String,
    display_name: String,
    region: String,
) -> Result<CloudAccount, CloudError> {
    // Validate credentials via STS
    let aws_account_id = aws::validate_profile(&profile_name, &region).await?;

    let account = CloudAccount {
        id: uuid::Uuid::new_v4().to_string(),
        provider: CloudProviderKind::Aws,
        profile_name,
        display_name,
        region,
        account_id: aws_account_id,
        auth_mode: AuthMode::Profile,
        access_key_id: None,
    };

    let mut accounts = load_accounts(&app)?;
    accounts.push(account.clone());
    save_accounts(&app, &accounts)?;

    Ok(account)
}

/// Add an account using manually provided access key + secret key.
/// The secret key is validated via STS but NOT stored in the Rust store —
/// the frontend stores it encrypted in Stronghold.
#[tauri::command]
pub async fn cloud_add_manual_account(
    app: AppHandle,
    access_key: String,
    secret_key: String,
    display_name: String,
    region: String,
) -> Result<CloudAccount, CloudError> {
    // Validate credentials via STS
    let aws_account_id = aws::validate_static(&access_key, &secret_key, &region).await?;

    let account = CloudAccount {
        id: uuid::Uuid::new_v4().to_string(),
        provider: CloudProviderKind::Aws,
        profile_name: String::new(), // not used for manual accounts
        display_name,
        region,
        account_id: aws_account_id,
        auth_mode: AuthMode::Manual,
        access_key_id: Some(access_key),
    };

    let mut accounts = load_accounts(&app)?;
    accounts.push(account.clone());
    save_accounts(&app, &accounts)?;

    Ok(account)
}

#[tauri::command]
pub async fn cloud_list_accounts(app: AppHandle) -> Result<Vec<CloudAccount>, CloudError> {
    load_accounts(&app)
}

#[tauri::command]
pub async fn cloud_remove_account(
    app: AppHandle,
    account_id: String,
) -> Result<(), CloudError> {
    let mut accounts = load_accounts(&app)?;
    let original_len = accounts.len();
    accounts.retain(|a| a.id != account_id);

    if accounts.len() == original_len {
        return Err(CloudError::NotFound(format!(
            "Account not found: {account_id}"
        )));
    }

    save_accounts(&app, &accounts)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn find_account(app: &AppHandle, account_id: &str) -> Result<CloudAccount, CloudError> {
    let accounts = load_accounts(app)?;
    accounts
        .into_iter()
        .find(|a| a.id == account_id)
        .ok_or_else(|| CloudError::NotFound(format!("Account not found: {account_id}")))
}

// ---------------------------------------------------------------------------
// EC2 operations
// ---------------------------------------------------------------------------

/// List EC2 instances. For manual accounts, `secret_key` must be provided
/// (the frontend retrieves it from Stronghold before calling this).
#[tauri::command]
pub async fn cloud_list_instances(
    app: AppHandle,
    account_id: String,
    secret_key: Option<String>,
) -> Result<Vec<CloudResource>, CloudError> {
    let account = find_account(&app, &account_id)?;
    let config = aws::config_for_account(&account, secret_key.as_deref()).await;
    aws::list_ec2(&config).await
}

/// Perform an instance action. For manual accounts, `secret_key` must be provided.
#[tauri::command]
pub async fn cloud_instance_action(
    app: AppHandle,
    account_id: String,
    instance_id: String,
    action: InstanceAction,
    secret_key: Option<String>,
) -> Result<(), CloudError> {
    let account = find_account(&app, &account_id)?;
    let config = aws::config_for_account(&account, secret_key.as_deref()).await;
    aws::ec2_action(&config, &instance_id, action).await
}
