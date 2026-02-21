"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, FolderGit2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { tauriInvoke, tauriListen } from "@/lib/tauri";

export interface ScanRepoInfo {
  path: string;
  name: string;
  remote_url: string | null;
  has_zentral_config: boolean;
  is_worktree: boolean;
  worktree_parent: string | null;
}

interface ScanCompletePayload {
  total: number;
  elapsed_ms: number;
}

interface Props {
  roots: string[];
  onComplete: (repos: ScanRepoInfo[]) => void;
  onBack: () => void;
}

export function DiscoveryScanResults({ roots, onComplete, onBack }: Props) {
  const [repos, setRepos] = useState<ScanRepoInfo[]>([]);
  const [done, setDone] = useState(false);
  const [slowWarning, setSlowWarning] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    let cancelled = false;

    async function startScan() {
      try {
        const unResult = await tauriListen<ScanRepoInfo>("zentral://scan-result", (repo) => {
          if (!cancelled) setRepos((prev) => [...prev, repo]);
        });
        unlisteners.push(unResult);

        const unComplete = await tauriListen<ScanCompletePayload>("zentral://scan-complete", (payload) => {
          if (!cancelled) {
            setDone(true);
            setElapsed(payload.elapsed_ms);
          }
        });
        unlisteners.push(unComplete);

        const unSlow = await tauriListen<string>("zentral://scan-slow-warning", () => {
          if (!cancelled) setSlowWarning(true);
        });
        unlisteners.push(unSlow);

        await tauriInvoke("zentral_scan_repos", { roots, depth: 2 });
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }

    startScan();
    return () => {
      cancelled = true;
      unlisteners.forEach((u) => u());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleRepos = repos.filter((r) => !r.is_worktree);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Scanning…</h2>
        {!done && <Loader2 className="text-muted-foreground size-4 animate-spin" />}
        {done && <CheckCircle2 className="size-4 text-green-500" />}
      </div>

      {slowWarning && (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <AlertTriangle className="size-4 text-amber-500" />
          Scan is taking longer than expected…
        </div>
      )}

      {error && (
        <p className="text-destructive text-sm">{error}</p>
      )}

      {/* Live result list */}
      <div className="max-h-64 overflow-y-auto rounded-lg border">
        {visibleRepos.length === 0 && !done && (
          <p className="text-muted-foreground p-4 text-center text-sm">
            Looking for repositories…
          </p>
        )}
        {visibleRepos.map((r) => (
          <div
            key={r.path}
            className="flex items-center gap-2 border-b px-3 py-2 last:border-0"
          >
            <FolderGit2 className="text-muted-foreground size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
            {r.has_zentral_config && (
              <Badge variant="secondary" className="text-xs">zentral</Badge>
            )}
          </div>
        ))}
      </div>

      {done && (
        <p className="text-muted-foreground text-sm">
          Found {visibleRepos.length} repositories
          {elapsed !== null && ` in ${(elapsed / 1000).toFixed(1)}s`}.
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          Back
        </Button>
        <Button
          className="ml-auto"
          disabled={!done || visibleRepos.length === 0}
          onClick={() => onComplete(visibleRepos)}
        >
          Select repos
        </Button>
      </div>
    </div>
  );
}
