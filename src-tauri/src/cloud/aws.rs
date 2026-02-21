// AWS cloud provider implementation — profile parsing, credential validation, EC2 operations

use crate::cloud::error::CloudError;
use crate::cloud::types::{AuthMode, CloudAccount, CloudResource, InstanceAction, ResourceTag};

/// Parse ~/.aws/credentials and ~/.aws/config to list available profile names.
/// Returns empty Vec if files don't exist (e.g., no AWS CLI installed on Windows).
pub fn list_aws_profiles() -> Vec<String> {
    let mut profiles = std::collections::HashSet::new();

    if let Some(home) = dirs::home_dir() {
        // Parse ~/.aws/credentials: sections are [profile-name]
        let creds_path = home.join(".aws").join("credentials");
        if let Ok(content) = std::fs::read_to_string(&creds_path) {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with('[') && trimmed.ends_with(']') {
                    profiles.insert(trimmed[1..trimmed.len() - 1].to_string());
                }
            }
        }

        // Parse ~/.aws/config: sections are [profile profile-name] or [default]
        let config_path = home.join(".aws").join("config");
        if let Ok(content) = std::fs::read_to_string(&config_path) {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with('[') && trimmed.ends_with(']') {
                    let inner = &trimmed[1..trimmed.len() - 1];
                    if let Some(name) = inner.strip_prefix("profile ") {
                        profiles.insert(name.to_string());
                    } else {
                        profiles.insert(inner.to_string());
                    }
                }
            }
        }
    }

    let mut result: Vec<String> = profiles.into_iter().collect();
    result.sort();
    result
}

// ---------------------------------------------------------------------------
// Config builders
// ---------------------------------------------------------------------------

/// Build an AWS SDK config from a named profile + region.
async fn config_from_profile(profile_name: &str, region: &str) -> aws_types::SdkConfig {
    aws_config::defaults(aws_config::BehaviorVersion::latest())
        .profile_name(profile_name)
        .region(aws_config::Region::new(region.to_string()))
        .load()
        .await
}

/// Build an AWS SDK config from static access key + secret key.
async fn config_from_keys(
    access_key: &str,
    secret_key: &str,
    region: &str,
) -> aws_types::SdkConfig {
    let creds = aws_credential_types::Credentials::new(
        access_key,
        secret_key,
        None, // session token
        None, // expiry
        "arbeitsamt-manual",
    );
    aws_config::defaults(aws_config::BehaviorVersion::latest())
        .credentials_provider(creds)
        .region(aws_config::Region::new(region.to_string()))
        .load()
        .await
}

/// Build config for an account. For manual accounts, `secret_key` must be
/// provided (retrieved from Stronghold on the frontend side).
pub async fn config_for_account(
    account: &CloudAccount,
    secret_key: Option<&str>,
) -> aws_types::SdkConfig {
    match account.auth_mode {
        AuthMode::Manual => {
            let ak = account.access_key_id.as_deref().unwrap_or_default();
            config_from_keys(ak, secret_key.unwrap_or_default(), &account.region).await
        }
        AuthMode::Profile => config_from_profile(&account.profile_name, &account.region).await,
    }
}

// ---------------------------------------------------------------------------
// STS validation
// ---------------------------------------------------------------------------

async fn sts_validate(config: &aws_types::SdkConfig, label: &str) -> Result<String, CloudError> {
    let sts = aws_sdk_sts::Client::new(config);
    let resp = sts
        .get_caller_identity()
        .send()
        .await
        .map_err(|e| CloudError::AuthFailed(format!("STS validation failed for '{label}': {e}")))?;
    Ok(resp.account().unwrap_or("unknown").to_string())
}

/// Validate a named profile's credentials. Returns AWS account ID.
pub async fn validate_profile(profile_name: &str, region: &str) -> Result<String, CloudError> {
    let config = config_from_profile(profile_name, region).await;
    sts_validate(&config, profile_name).await
}

/// Validate static credentials. Returns AWS account ID.
pub async fn validate_static(
    access_key: &str,
    secret_key: &str,
    region: &str,
) -> Result<String, CloudError> {
    let config = config_from_keys(access_key, secret_key, region).await;
    let label = format!("manual:{}", &access_key[..access_key.len().min(8)]);
    sts_validate(&config, &label).await
}

// ---------------------------------------------------------------------------
// EC2 operations
// ---------------------------------------------------------------------------

/// List all EC2 instances for a given SDK config.
pub async fn list_ec2(config: &aws_types::SdkConfig) -> Result<Vec<CloudResource>, CloudError> {
    let ec2 = aws_sdk_ec2::Client::new(config);

    let resp = ec2
        .describe_instances()
        .send()
        .await
        .map_err(|e| CloudError::AwsApiError(format!("DescribeInstances failed: {e}")))?;

    let mut resources = Vec::new();

    for reservation in resp.reservations() {
        for instance in reservation.instances() {
            let name = instance
                .tags()
                .iter()
                .find(|t| t.key() == Some("Name"))
                .and_then(|t| t.value())
                .unwrap_or_default()
                .to_string();

            let instance_id = instance.instance_id().unwrap_or_default().to_string();

            resources.push(CloudResource {
                name: if name.is_empty() {
                    instance_id.clone()
                } else {
                    name
                },
                instance_id,
                instance_type: instance
                    .instance_type()
                    .map(|t| t.as_str().to_string())
                    .unwrap_or_default(),
                state: instance
                    .state()
                    .and_then(|s| s.name())
                    .map(|n| n.as_str().to_string())
                    .unwrap_or_else(|| "unknown".to_string()),
                public_ip: instance.public_ip_address().map(|s| s.to_string()),
                private_ip: instance.private_ip_address().map(|s| s.to_string()),
                launch_time: instance.launch_time().map(|t| t.to_string()),
                tags: instance
                    .tags()
                    .iter()
                    .map(|t| ResourceTag {
                        key: t.key().unwrap_or_default().to_string(),
                        value: t.value().unwrap_or_default().to_string(),
                    })
                    .collect(),
            });
        }
    }

    Ok(resources)
}

/// Perform an action on an EC2 instance.
pub async fn ec2_action(
    config: &aws_types::SdkConfig,
    instance_id: &str,
    action: InstanceAction,
) -> Result<(), CloudError> {
    let ec2 = aws_sdk_ec2::Client::new(config);

    match action {
        InstanceAction::Start => {
            ec2.start_instances()
                .instance_ids(instance_id)
                .send()
                .await
                .map_err(|e| CloudError::AwsApiError(format!("StartInstances failed: {e}")))?;
        }
        InstanceAction::Stop => {
            ec2.stop_instances()
                .instance_ids(instance_id)
                .send()
                .await
                .map_err(|e| CloudError::AwsApiError(format!("StopInstances failed: {e}")))?;
        }
        InstanceAction::Reboot => {
            ec2.reboot_instances()
                .instance_ids(instance_id)
                .send()
                .await
                .map_err(|e| CloudError::AwsApiError(format!("RebootInstances failed: {e}")))?;
        }
        InstanceAction::Terminate => {
            ec2.terminate_instances()
                .instance_ids(instance_id)
                .send()
                .await
                .map_err(|e| {
                    CloudError::AwsApiError(format!("TerminateInstances failed: {e}"))
                })?;
        }
    }

    Ok(())
}
