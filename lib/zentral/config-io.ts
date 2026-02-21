"use client";

import type { ZentralConfig, ZentralProjectEntry } from "./types";

const CONFIG_FILENAME = ".zentral.json";
const SUPPORTED_VERSION = "1" as const;

async function fsRead(path: string): Promise<string> {
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  return readTextFile(path);
}

async function fsWrite(path: string, content: string): Promise<void> {
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  return writeTextFile(path, content);
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Serialize a project's ZentralConfig to `{localPath}/.zentral.json`.
 * Only cloud connections with `exportEnabled === true` are included.
 */
export async function exportProjectConfig(
  project: ZentralProjectEntry,
): Promise<void> {
  if (!project.localPath) {
    throw new Error(`Project "${project.name}" has no local path — cannot export config`);
  }

  const base = project.config ?? { version: SUPPORTED_VERSION, name: project.name, servers: [], cloud: [] };

  const config: ZentralConfig = {
    version: SUPPORTED_VERSION,
    name: base.name,
    ...(base.description ? { description: base.description } : {}),
    servers: base.servers ?? [],
    cloud: (base.cloud ?? []).filter((c) => c.exportEnabled),
  };

  const filePath = `${project.localPath}/${CONFIG_FILENAME}`;
  await fsWrite(filePath, JSON.stringify(config, null, 2));
}

// ─── Import ───────────────────────────────────────────────────────────────────

/**
 * Read and parse `{localPath}/.zentral.json`.
 * Returns null if the file does not exist.
 * Throws on malformed JSON or unsupported version.
 */
export async function importProjectConfig(
  localPath: string,
): Promise<ZentralConfig | null> {
  const filePath = `${localPath}/${CONFIG_FILENAME}`;

  let raw: string;
  try {
    raw = await fsRead(filePath);
  } catch {
    // File not found is expected — return null
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Malformed JSON in ${CONFIG_FILENAME}`);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`Invalid ${CONFIG_FILENAME}: expected an object`);
  }

  const obj = parsed as Record<string, unknown>;

  if (obj["version"] !== SUPPORTED_VERSION) {
    throw new Error(
      `Unsupported .zentral.json version "${obj["version"]}" (expected "${SUPPORTED_VERSION}")`,
    );
  }

  return {
    version: SUPPORTED_VERSION,
    name: typeof obj["name"] === "string" ? obj["name"] : "",
    ...(typeof obj["description"] === "string" ? { description: obj["description"] } : {}),
    servers: Array.isArray(obj["servers"]) ? obj["servers"] : [],
    cloud: Array.isArray(obj["cloud"]) ? obj["cloud"] : [],
  };
}

// ─── Stub ─────────────────────────────────────────────────────────────────────

/**
 * Write a minimal `.zentral.json` stub to `{localPath}/.zentral.json`.
 * Called after manual project registration (non-clone path).
 */
export async function writeConfigStub(
  localPath: string,
  name: string,
): Promise<void> {
  const stub: ZentralConfig = {
    version: SUPPORTED_VERSION,
    name,
    servers: [],
    cloud: [],
  };
  const filePath = `${localPath}/${CONFIG_FILENAME}`;
  await fsWrite(filePath, JSON.stringify(stub, null, 2));
}
