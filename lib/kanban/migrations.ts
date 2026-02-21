// ---------------------------------------------------------------------------
// Migration runner
// ---------------------------------------------------------------------------
// Currently only version 1 exists. The runner is structured so that future
// versions can be added as sequential migration steps without reworking the
// call site.
//
// Pattern:
//   - Each migration function takes the raw payload from the previous version
//     and returns the raw payload for the next version.
//   - runMigrations walks from the detected version up to CURRENT_VERSION.
// ---------------------------------------------------------------------------

const CURRENT_VERSION = 1;

// ---------------------------------------------------------------------------
// Version-specific migration steps
// (Add a new entry here for each future schema version.)
// ---------------------------------------------------------------------------

type MigrationFn = (raw: Record<string, unknown>) => Record<string, unknown>;

const MIGRATIONS: Record<number, MigrationFn> = {
  // v0 → v1: first version, nothing to transform
  1: (raw) => ({ ...raw, version: 1 }),
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run all pending migrations on a raw, unvalidated store payload.
 *
 * Returns the migrated payload (still unvalidated — caller must run Zod after).
 * Throws if the raw value is not a plain object.
 */
export function runMigrations(raw: unknown): unknown {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("runMigrations: expected a plain object");
  }

  let current = raw as Record<string, unknown>;
  const detectedVersion =
    typeof current["version"] === "number" ? (current["version"] as number) : 0;

  for (let v = detectedVersion + 1; v <= CURRENT_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (migrate) {
      current = migrate(current);
    }
  }

  return current;
}
