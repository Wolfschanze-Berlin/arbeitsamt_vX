"use client";

import { useState, useEffect, useMemo } from "react";
import { Server, Search, Loader2, FolderGit2, Wifi } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useZentral } from "@/context/ZentralContext";
import { tauriInvoke } from "@/lib/tauri";
import type { ZentralProjectEntry, ZentralConfig } from "@/lib/zentral/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RemoteRepoInfo {
  path: string;
  name: string;
  remote_url: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract `owner/repo` from a git remote URL. */
function extractFullName(url: string): string | null {
  const cleaned = url.replace(/\.git$/, "");
  // SSH format: git@github.com:owner/repo
  const sshMatch = cleaned.match(/git@[^:]+:(.+)/);
  if (sshMatch) return sshMatch[1];
  // HTTPS format: https://github.com/owner/repo
  try {
    const parsed = new URL(cleaned);
    const path = parsed.pathname.replace(/^\//, "");
    return path || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AddFromServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFromServerDialog({
  open,
  onOpenChange,
}: AddFromServerDialogProps) {
  const { addOrUpdateProject } = useZentral();

  // Step 1: Pick server
  const [hosts, setHosts] = useState<string[]>([]);
  const [hostsLoading, setHostsLoading] = useState(false);
  const [selectedHost, setSelectedHost] = useState<string>("");

  // Step 2: Scan results
  const [repos, setRepos] = useState<RemoteRepoInfo[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Step 3: Select + import
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<RemoteRepoInfo | null>(null);
  const [importing, setImporting] = useState(false);

  // Load SSH config hosts when dialog opens
  useEffect(() => {
    if (!open) return;
    setHostsLoading(true);
    tauriInvoke<string[]>("ssh_list_config_hosts")
      .then(setHosts)
      .catch(() => setHosts([]))
      .finally(() => setHostsLoading(false));
  }, [open]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedHost("");
      setRepos([]);
      setScanning(false);
      setScanError(null);
      setFilter("");
      setSelected(null);
    }
  }, [open]);

  // Start scan
  async function handleScan() {
    if (!selectedHost) return;
    setScanning(true);
    setScanError(null);
    setRepos([]);
    setSelected(null);

    try {
      // Listen for streaming results
      const { listen } = await import("@tauri-apps/api/event");

      const collected: RemoteRepoInfo[] = [];

      const unlistenResult = await listen<RemoteRepoInfo>(
        "zentral://ssh-scan-result",
        (event) => {
          collected.push(event.payload);
          setRepos([...collected]);
        },
      );

      const unlistenComplete = await listen<{ total: number; elapsed_ms: number }>(
        "zentral://ssh-scan-complete",
        () => {
          setScanning(false);
          unlistenResult();
          unlistenComplete();
        },
      );

      // Fire the scan command
      await tauriInvoke("zentral_scan_remote_repos", { host: selectedHost });
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err));
      setScanning(false);
    }
  }

  // Filter repos by search text
  const filtered = useMemo(() => {
    if (!filter) return repos;
    const q = filter.toLowerCase();
    return repos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.path.toLowerCase().includes(q) ||
        (r.remote_url ?? "").toLowerCase().includes(q),
    );
  }, [repos, filter]);

  // Import selected repo as project
  async function handleImport() {
    if (!selected) return;
    setImporting(true);
    try {
      const fullName = selected.remote_url
        ? extractFullName(selected.remote_url)
        : null;

      const config: ZentralConfig = {
        version: "1",
        name: selected.name,
        servers: [
          {
            sshAlias: selectedHost,
            repoPath: selected.path,
          },
        ],
        cloud: [],
      };

      const entry: ZentralProjectEntry = {
        id: crypto.randomUUID(),
        canonicalId: fullName ?? `${selectedHost}:${selected.path}`,
        name: selected.name,
        localPath: null,
        remoteUrl: selected.remote_url,
        repoFullName: fullName,
        config,
        importedAt: new Date().toISOString(),
      };

      await addOrUpdateProject(entry);
      onOpenChange(false);
    } finally {
      setImporting(false);
    }
  }

  const hasScanned = repos.length > 0 || scanError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="size-5" />
            Add from Server
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            Scan a remote server for git repositories and track one as a
            project.
          </p>

          {/* Host picker */}
          <div className="flex gap-2">
            <Select value={selectedHost} onValueChange={setSelectedHost}>
              <SelectTrigger className="flex-1">
                <SelectValue
                  placeholder={
                    hostsLoading ? "Loading hosts…" : "Select SSH host"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {hosts.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              disabled={!selectedHost || scanning}
              onClick={handleScan}
              title="Scan for repositories"
            >
              {scanning ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wifi className="size-4" />
              )}
            </Button>
          </div>

          {/* Scan error */}
          {scanError && (
            <p className="text-destructive text-sm">{scanError}</p>
          )}

          {/* Scanning indicator */}
          {scanning && repos.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="text-muted-foreground size-5 animate-spin" />
              <span className="text-muted-foreground text-sm">
                Scanning server…
              </span>
            </div>
          )}

          {/* Results */}
          {hasScanned && repos.length > 0 && (
            <>
              {/* Filter */}
              <div className="relative">
                <Search className="text-muted-foreground absolute left-2.5 top-2.5 size-4" />
                <Input
                  placeholder="Filter repositories…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="pl-9"
                />
              </div>

              <ScrollArea className="h-64 rounded-md border">
                <div className="flex flex-col divide-y">
                  {filtered.map((repo) => (
                    <button
                      key={repo.path}
                      type="button"
                      onClick={() => setSelected(repo)}
                      className={`flex items-start gap-3 p-3 text-left transition-colors ${
                        selected?.path === repo.path
                          ? "bg-accent"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <FolderGit2 className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {repo.name}
                        </p>
                        <p className="text-muted-foreground mt-0.5 truncate font-mono text-xs">
                          {repo.path}
                        </p>
                        {repo.remote_url && (
                          <p className="text-muted-foreground mt-0.5 truncate text-xs">
                            {repo.remote_url}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>

              {scanning && (
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Loader2 className="size-3 animate-spin" />
                  Still scanning… ({repos.length} found)
                </p>
              )}
            </>
          )}

          {hasScanned && !scanError && repos.length === 0 && !scanning && (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No git repositories found on this server.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!selected || importing}
          >
            {importing ? "Adding…" : "Add Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
