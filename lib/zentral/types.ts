// Die Zentral — core TypeScript types

// --- Cloud Connection ---

export type CloudConnectionType =
  | "aws"
  | "gcp"
  | "azure"
  | "docker-registry"
  | "database"
  | "ci-cd"
  | "monitoring"
  | "generic";

export const CLOUD_CONNECTION_TYPES: CloudConnectionType[] = [
  "aws",
  "gcp",
  "azure",
  "docker-registry",
  "database",
  "ci-cd",
  "monitoring",
  "generic",
];

export type CloudEnvironment =
  | "production"
  | "staging"
  | "development"
  | "other";

export const CLOUD_ENVIRONMENTS: CloudEnvironment[] = [
  "production",
  "staging",
  "development",
  "other",
];

export interface ZentralCloudConnection {
  id: string;
  type: CloudConnectionType;
  label: string;
  environment: CloudEnvironment;
  url?: string;
  urlOverride?: string;
  exportEnabled: boolean;
  config: Record<string, string>;
}

// --- Config (.zentral.json schema) ---

export interface ZentralServer {
  sshAlias: string;
  label?: string;
  cloneDir?: string;
  /** Path to the repo on this server (for remote-only projects). */
  repoPath?: string;
}

export interface ZentralConfig {
  version: "1";
  name: string;
  description?: string;
  servers: ZentralServer[];
  cloud: ZentralCloudConnection[];
}

// --- Project Entry (stored in tauri-plugin-store) ---

export interface ZentralProjectEntry {
  id: string;
  canonicalId: string;
  name: string;
  localPath: string | null;
  remoteUrl: string | null;
  repoFullName: string | null;
  config: ZentralConfig | null;
  importedAt: string;
}
