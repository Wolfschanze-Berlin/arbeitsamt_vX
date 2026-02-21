/**
 * Tauri persistence layer for the Kanban store.
 *
 * Uses @tauri-apps/plugin-store with lazy-loading to match the lib/tauri.ts
 * pattern — the plugin is never imported at module load time so that Next.js
 * dev mode (Node.js context) does not crash on import.
 */

import { KanbanStoreSchema } from "./schemas";
import type { KanbanStore } from "./types";
import { runMigrations } from "./migrations";
import { DEFAULT_STORE } from "./seed";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORE_FILE = "kanban.json";
const STORE_KEY = "kanban";

// ---------------------------------------------------------------------------
// Environment guard (mirrors isTauriEnvironment from lib/tauri.ts)
// ---------------------------------------------------------------------------

function isTauriEnvironment(): boolean {
  return (
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
  );
}

// ---------------------------------------------------------------------------
// Lazy store accessor
// ---------------------------------------------------------------------------

async function getPluginStore() {
  if (!isTauriEnvironment()) {
    throw new Error("kanban store: not running in a Tauri webview");
  }
  const { load } = await import("@tauri-apps/plugin-store");
  return load(STORE_FILE, { defaults: {}, autoSave: false });
}

// ---------------------------------------------------------------------------
// Discriminated union result type
// ---------------------------------------------------------------------------

export type KanbanLoadResult =
  | { ok: true; store: KanbanStore }
  | {
      ok: false;
      reason: "empty" | "corrupt" | "migration_failed";
      backupPath?: string;
    };

// ---------------------------------------------------------------------------
// kanbanLoad
// ---------------------------------------------------------------------------

/**
 * Load the store from disk.
 *
 * Steps:
 * 1. Open the plugin store file.
 * 2. Read the raw value for STORE_KEY.
 * 3. Run version migrations.
 * 4. Validate with Zod.
 * 5. Return a discriminated union result.
 */
export async function kanbanLoad(): Promise<KanbanLoadResult> {
  const pluginStore = await getPluginStore();

  const raw = await pluginStore.get<unknown>(STORE_KEY);

  if (raw === null || raw === undefined) {
    return { ok: false, reason: "empty" };
  }

  let migrated: unknown;
  try {
    migrated = runMigrations(raw);
  } catch {
    return { ok: false, reason: "migration_failed" };
  }

  const parsed = KanbanStoreSchema.safeParse(migrated);
  if (!parsed.success) {
    return { ok: false, reason: "corrupt" };
  }

  return { ok: true, store: parsed.data };
}

// ---------------------------------------------------------------------------
// kanbanSave
// ---------------------------------------------------------------------------

/**
 * Persist the store to disk with an explicit flush.
 */
export async function kanbanSave(store: KanbanStore): Promise<void> {
  const pluginStore = await getPluginStore();
  await pluginStore.set(STORE_KEY, store);
  await pluginStore.save();
}

// ---------------------------------------------------------------------------
// kanbanLoadSafe
// ---------------------------------------------------------------------------

/**
 * Load the store, falling back to DEFAULT_STORE on any error.
 *
 * On corruption a backup of the raw value is written to
 * `kanban.backup.<timestamp>.json` before the seed is saved.
 */
export async function kanbanLoadSafe(): Promise<KanbanStore> {
  let result: KanbanLoadResult;

  try {
    result = await kanbanLoad();
  } catch {
    // Tauri not available or unexpected error — return seed without saving
    return DEFAULT_STORE;
  }

  if (result.ok) {
    return result.store;
  }

  if (result.reason === "corrupt") {
    // Attempt to write a backup before overwriting
    const backupPath = await writeBackup();
    // backupPath is informational; we log but do not throw
    if (backupPath) {
      console.warn(
        `[kanban] Corrupt store backed up to ${backupPath}. Resetting to seed.`
      );
    }
  }

  // Seed and persist the default store
  try {
    await kanbanSave(DEFAULT_STORE);
  } catch {
    // Best-effort — if save fails, still return the seed in memory
  }

  return DEFAULT_STORE;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Write the current raw store value as a timestamped backup file.
 * Returns the backup file name, or undefined if the write failed.
 */
async function writeBackup(): Promise<string | undefined> {
  try {
    const { load } = await import("@tauri-apps/plugin-store");

    // Read raw value from the primary store
    const pluginStore = await load(STORE_FILE, { defaults: {}, autoSave: false });
    const raw = await pluginStore.get<unknown>(STORE_KEY);

    // Write to a timestamped backup store file
    const backupFile = `kanban.backup.${Date.now()}.json`;
    const backupStore = await load(backupFile, { defaults: {}, autoSave: false });
    await backupStore.set("backup", raw);
    await backupStore.save();

    return backupFile;
  } catch {
    return undefined;
  }
}
