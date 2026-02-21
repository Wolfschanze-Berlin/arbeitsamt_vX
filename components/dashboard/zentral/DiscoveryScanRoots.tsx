"use client";

import { useState } from "react";
import { Folder, Plus, Trash2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
interface Props {
  roots: string[];
  onRootsChange: (roots: string[]) => void;
  onNext: () => void;
}

const SUGGESTED_ROOTS: string[] = [
  "~/workspaces",
  "~/projects",
  "~/dev",
  "~/code",
  "~/src",
  "~/repos",
];

async function openDirPicker(): Promise<string | null> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return null;
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({ directory: true, multiple: false });
  return result ?? null;
}

export function DiscoveryScanRoots({ roots, onRootsChange, onNext }: Props) {
  const [checking, setChecking] = useState(false);

  async function handleAddSuggested(raw: string) {
    if (roots.includes(raw)) return;
    setChecking(true);
    // expand ~ client-side via tauri home dir or just add as-is
    onRootsChange([...roots, raw]);
    setChecking(false);
  }

  async function handleBrowse() {
    const dir = await openDirPicker();
    if (dir && !roots.includes(dir)) {
      onRootsChange([...roots, dir]);
    }
  }

  function handleRemove(path: string) {
    onRootsChange(roots.filter((r) => r !== path));
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold">Where are your projects?</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Choose folders to scan for git repositories.
        </p>
      </div>

      {/* Suggested roots */}
      <div>
        <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
          Common locations
        </p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_ROOTS.map((s) => {
            const added = roots.includes(s);
            return (
              <Badge
                key={s}
                variant={added ? "default" : "outline"}
                className="cursor-pointer gap-1 py-1 text-xs"
                onClick={() => !added && handleAddSuggested(s)}
              >
                <Folder className="size-3" />
                {s}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Selected roots list */}
      {roots.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
            Selected folders ({roots.length})
          </p>
          {roots.map((r) => (
            <div
              key={r}
              className="bg-muted flex items-center justify-between rounded-md px-3 py-2"
            >
              <span className="flex items-center gap-2 truncate text-sm">
                <FolderOpen className="text-muted-foreground size-4 shrink-0" />
                <span className="truncate">{r}</span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                onClick={() => handleRemove(r)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleBrowse}>
          <Plus className="size-4" />
          Browse…
        </Button>

        <Button
          className="ml-auto"
          disabled={roots.length === 0 || checking}
          onClick={onNext}
        >
          Scan for repos
        </Button>
      </div>
    </div>
  );
}
