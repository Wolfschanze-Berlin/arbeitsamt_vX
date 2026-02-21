"use client";

import { useState, useMemo } from "react";
import { Github, Globe, Search, Loader2 } from "lucide-react";
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
import { useZentral } from "@/context/ZentralContext";
import { useUserRepos } from "@/hooks/useGithub";
import type { GithubRepo } from "@/lib/github";
import type { ZentralProjectEntry } from "@/lib/zentral/types";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AddRemoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddRemoteDialog({ open, onOpenChange }: AddRemoteDialogProps) {
  const { addOrUpdateProject, projects } = useZentral();
  const { data: repos, isLoading } = useUserRepos(1, 100);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<GithubRepo | null>(null);
  const [importing, setImporting] = useState(false);

  // Repos already tracked in Zentrale (by full_name)
  const trackedNames = useMemo(
    () => new Set(projects.map((p) => p.repoFullName).filter(Boolean)),
    [projects],
  );

  // Filter repos by search text, exclude already-tracked
  const filtered = useMemo(() => {
    if (!repos) return [];
    const q = filter.toLowerCase();
    return repos.filter(
      (r) =>
        !trackedNames.has(r.full_name) &&
        (r.full_name.toLowerCase().includes(q) ||
          (r.description ?? "").toLowerCase().includes(q)),
    );
  }, [repos, filter, trackedNames]);

  async function handleImport() {
    if (!selected) return;
    setImporting(true);
    try {
      const entry: ZentralProjectEntry = {
        id: crypto.randomUUID(),
        canonicalId: selected.full_name,
        name: selected.name,
        localPath: null,
        remoteUrl: selected.clone_url,
        repoFullName: selected.full_name,
        config: null,
        importedAt: new Date().toISOString(),
      };
      await addOrUpdateProject(entry);
      onOpenChange(false);
      setSelected(null);
      setFilter("");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="size-5" />
            Track Remote Repository
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            Add a GitHub repository without cloning it locally. You can clone
            it later from the project settings.
          </p>

          {/* Search input */}
          <div className="relative">
            <Search className="text-muted-foreground absolute left-2.5 top-2.5 size-4" />
            <Input
              placeholder="Filter repositories…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Repo list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="text-muted-foreground size-6 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {filter
                ? "No matching repositories found."
                : "All your repositories are already tracked."}
            </p>
          ) : (
            <ScrollArea className="h-64 rounded-md border">
              <div className="flex flex-col divide-y">
                {filtered.map((repo) => (
                  <button
                    key={repo.full_name}
                    type="button"
                    onClick={() => setSelected(repo)}
                    className={`flex items-start gap-3 p-3 text-left transition-colors ${
                      selected?.full_name === repo.full_name
                        ? "bg-accent"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <Github className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {repo.full_name}
                      </p>
                      {repo.description && (
                        <p className="text-muted-foreground mt-0.5 truncate text-xs">
                          {repo.description}
                        </p>
                      )}
                      <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                        {repo.language && <span>{repo.language}</span>}
                        {repo.private && <span>Private</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
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
            {importing ? "Adding…" : "Track Repository"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
