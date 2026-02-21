"use client";

// Stronghold vault helpers for cloud secret key storage.
// The vault is initialized once per session and stores secret keys
// keyed by account ID.

import type { Client } from "@tauri-apps/plugin-stronghold";

const VAULT_FILE = "cloud-secrets.hold";
const CLIENT_NAME = "cloud-accounts";
const VAULT_PASSWORD = "arbeitsamt-cloud-vault";

let _stronghold: Awaited<
  ReturnType<typeof import("@tauri-apps/plugin-stronghold").Stronghold.load>
> | null = null;
let _client: Client | null = null;

async function getClient() {
  if (_client) return _client;

  const { Stronghold } = await import("@tauri-apps/plugin-stronghold");
  const { appDataDir } = await import("@tauri-apps/api/path");

  const dataDir = await appDataDir();
  const vaultPath = `${dataDir}/${VAULT_FILE}`;

  _stronghold = await Stronghold.load(vaultPath, VAULT_PASSWORD);

  try {
    _client = await _stronghold.loadClient(CLIENT_NAME);
  } catch {
    _client = await _stronghold.createClient(CLIENT_NAME);
  }

  return _client;
}

async function save() {
  if (_stronghold) await _stronghold.save();
}

/** Store a secret key for a cloud account. */
export async function storeSecretKey(
  accountId: string,
  secretKey: string,
): Promise<void> {
  const client = await getClient();
  const store = client.getStore();
  const data = Array.from(new TextEncoder().encode(secretKey));
  await store.insert(accountId, data);
  await save();
}

/** Retrieve a secret key for a cloud account. Returns null if not found. */
export async function getSecretKey(
  accountId: string,
): Promise<string | null> {
  try {
    const client = await getClient();
    const store = client.getStore();
    const data = await store.get(accountId);
    if (!data || data.length === 0) return null;
    return new TextDecoder().decode(new Uint8Array(data));
  } catch {
    return null;
  }
}

/** Remove a secret key for a cloud account. */
export async function removeSecretKey(accountId: string): Promise<void> {
  try {
    const client = await getClient();
    const store = client.getStore();
    await store.remove(accountId);
    await save();
  } catch {
    // Key may not exist — that's fine
  }
}
