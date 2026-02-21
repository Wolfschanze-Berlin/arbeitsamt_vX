export type CloudProviderKind = "Aws";
export type InstanceAction = "start" | "stop" | "reboot" | "terminate";

export type AuthMode = "profile" | "manual";

export interface CloudAccount {
  id: string;
  provider: CloudProviderKind;
  profileName: string;
  displayName: string;
  region: string;
  accountId: string;
  authMode: AuthMode;
  accessKeyId?: string;
}

export interface CloudResource {
  instanceId: string;
  name: string;
  instanceType: string;
  state: string;
  publicIp: string | null;
  privateIp: string | null;
  launchTime: string | null;
  tags: ResourceTag[];
}

export interface ResourceTag {
  key: string;
  value: string;
}

// AWS regions for the region selector
export const AWS_REGIONS = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-east-2", label: "US East (Ohio)" },
  { value: "us-west-1", label: "US West (N. California)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "eu-west-1", label: "EU (Ireland)" },
  { value: "eu-west-2", label: "EU (London)" },
  { value: "eu-central-1", label: "EU (Frankfurt)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
  { value: "ap-south-1", label: "Asia Pacific (Mumbai)" },
] as const;
