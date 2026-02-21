/**
 * Attachment utilities for Kanban cards.
 *
 * All Tauri API imports are lazy (inside async functions) to prevent
 * import-timing crashes in Next.js dev server (Node.js context).
 * Every exported function guards itself with isTauriEnvironment().
 */

function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Derive the base storage directory: `{appDataDir}/arbeitsamt/attachments/{cardId}/` */
async function resolveCardDir(cardId: string): Promise<string> {
  const { appDataDir, join } = await import("@tauri-apps/api/path");
  const base = await appDataDir();
  return join(base, "arbeitsamt", "attachments", cardId);
}

/** Build a unique destination filename: `{timestamp}-{originalFilename}` */
function buildDestFilename(srcPath: string): string {
  const parts = srcPath.replace(/\\/g, "/").split("/");
  const originalName = parts[parts.length - 1] ?? "file";
  return `${Date.now()}-${originalName}`;
}

/**
 * Open a multi-file picker, copy chosen files to APPDATA, and return their
 * relative paths (`arbeitsamt/attachments/{cardId}/{destFilename}`).
 *
 * Returns an empty array when outside Tauri or when the user cancels.
 */
export async function pickAndCopyAttachments(cardId: string): Promise<string[]> {
  if (!isTauriEnvironment()) return [];

  const { open } = await import("@tauri-apps/plugin-dialog");
  const { copyFile, mkdir } = await import("@tauri-apps/plugin-fs");
  const { appDataDir, join } = await import("@tauri-apps/api/path");

  const selected = await open({ multiple: true, directory: false });
  if (!selected) return [];

  const sources: string[] = Array.isArray(selected) ? selected : [selected];
  if (sources.length === 0) return [];

  const cardDir = await resolveCardDir(cardId);
  await mkdir(cardDir, { recursive: true });

  const base = await appDataDir();
  const relativePaths: string[] = [];

  for (const src of sources) {
    const destFilename = buildDestFilename(src);
    const destAbsolute = await join(cardDir, destFilename);
    await copyFile(src, destAbsolute);
    // Store path relative to appDataDir so it stays portable
    const relative = await join("arbeitsamt", "attachments", cardId, destFilename);
    relativePaths.push(relative);
  }

  // Suppress unused variable warning — base is used for documentation
  void base;

  return relativePaths;
}

/**
 * Open a single-file picker for a cover image, copy it to APPDATA, and
 * return the relative path.
 *
 * Returns `null` when outside Tauri or when the user cancels.
 */
export async function pickAndCopyCoverImage(cardId: string): Promise<string | null> {
  if (!isTauriEnvironment()) return null;

  const { open } = await import("@tauri-apps/plugin-dialog");
  const { copyFile, mkdir } = await import("@tauri-apps/plugin-fs");
  const { join } = await import("@tauri-apps/api/path");

  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
  });

  if (!selected || Array.isArray(selected)) return null;

  const cardDir = await resolveCardDir(cardId);
  await mkdir(cardDir, { recursive: true });

  const destFilename = buildDestFilename(selected);
  const destAbsolute = await join(cardDir, destFilename);
  await copyFile(selected, destAbsolute);

  return join("arbeitsamt", "attachments", cardId, destFilename);
}

/**
 * Convert a stored relative path to a displayable `asset://` URL via
 * `convertFileSrc`.
 *
 * Returns an empty string when outside Tauri.
 */
export async function resolveAttachmentUrl(relativePath: string): Promise<string> {
  if (!isTauriEnvironment()) return "";

  const { appDataDir, join } = await import("@tauri-apps/api/path");
  const { convertFileSrc } = await import("@tauri-apps/api/core");

  const base = await appDataDir();
  const absolute = await join(base, relativePath);
  return convertFileSrc(absolute);
}

/**
 * Delete an attachment file from disk (best-effort — errors are swallowed).
 */
export async function removeAttachment(relativePath: string): Promise<void> {
  if (!isTauriEnvironment()) return;

  try {
    const { appDataDir, join } = await import("@tauri-apps/api/path");
    const { remove } = await import("@tauri-apps/plugin-fs");

    const base = await appDataDir();
    const absolute = await join(base, relativePath);
    await remove(absolute);
  } catch {
    // Best-effort: missing file is acceptable
  }
}
