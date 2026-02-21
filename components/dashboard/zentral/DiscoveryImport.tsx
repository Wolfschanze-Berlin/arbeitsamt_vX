"use client";

import { useState } from "react";
import { FolderGit2, CheckSquare, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { tauriInvoke } from "@/lib/tauri";
import { useZentral } from "@/context/ZentralContext";
import type { ZentralProjectEntry } from "@/lib/zentral/types";
import type { ScanRepoInfo } from "./DiscoveryScanResults";

interface LocalPathInfo {
  path: string;
  name: string;
  remote_url: string | null;
  repo_full_name: string | null;
  has_zentral_config: boolean;
  zentral_config: unknown | null;
}

interface Props {
  repos: ScanRepoInfo[];
  onDone: () => void;
  onBack: () => void;
}

export function DiscoveryImport({ repos, onDone, onBack }: Props) {
  const { addOrUpdateProject } = useZentral();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(repos.map((r) => r.path)));
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  function toggleAll() {
    setSelected((prev) =>
      prev.size === repos.length ? new Set() : new Set(repos.map((r) => r.path))
    );
  }

  function toggleOne(path: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }

  async function handleImport() {
    setImporting(true);
    const toImport = repos.filter((r) => selected.has(r.path));
    let done = 0;

    for (const repo of toImport) {
      try {
        const info = await tauriInvoke<LocalPathInfo>("zentral_import_local_path", {
          path: repo.path,
        });
        const entry: ZentralProjectEntry = {
          id: crypto.randomUUID(),
          canonicalId: info.repo_full_name ?? info.path,
          name: info.name,
          localPath: info.path,
          remoteUrl: info.remote_url,
          repoFullName: info.repo_full_name,
          config: null,
          importedAt: new Date().toISOString(),
        };
        await addOrUpdateProject(entry);
      } catch {
        // Skip repos that fail to import (e.g. permission errors)
      }
      done++;
      setProgress(done);
    }

    onDone();
  }

  const allChecked = selected.size === repos.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Select repositories to import</h2>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={toggleAll}>
          {allChecked ? <CheckSquare className="size-3.5" /> : <Square className="size-3.5" />}
          {allChecked ? "Deselect all" : "Select all"}
        </Button>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-lg border">
        {repos.map((r) => {
          const checked = selected.has(r.path);
          return (
            <button
              key={r.path}
              type="button"
              className="flex w-full items-center gap-2 border-b px-3 py-2.5 text-left last:border-0 hover:bg-accent"
              onClick={() => toggleOne(r.path)}
            >
              {checked ? (
                <CheckSquare className="size-4 shrink-0 text-primary" />
              ) : (
                <Square className="text-muted-foreground size-4 shrink-0" />
              )}
              <FolderGit2 className="text-muted-foreground size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
              {r.has_zentral_config && (
                <Badge variant="secondary" className="text-xs">zentral</Badge>
              )}
            </button>
          );
        })}
      </div>

      <div className="text-muted-foreground text-sm">
        {selected.size} of {repos.length} selected
        {importing && ` — importing ${progress}/${selected.size}…`}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBack} disabled={importing}>
          Back
        </Button>
        <Button
          className="ml-auto gap-1.5"
          disabled={selected.size === 0 || importing}
          onClick={handleImport}
        >
          {importing && <Loader2 className="size-4 animate-spin" />}
          Import {selected.size > 0 ? selected.size : ""} repos
        </Button>
      </div>
    </div>
  );
}
