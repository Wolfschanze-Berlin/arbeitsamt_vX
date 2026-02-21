"use client";

import { useState, useCallback } from "react";
import { Github, Search, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  getAuthenticatedUser,
  getUserOrgs,
  GithubError,
  type GithubRepo,
} from "@/lib/github";
import { useZentral } from "@/context/ZentralContext";
import type { ZentralProjectEntry } from "@/lib/zentral/types";

// --- Types ---

interface CodeSearchItem {
  repository: Pick<
    GithubRepo,
    "name" | "full_name" | "description" | "html_url"
  >;
}

interface CodeSearchResult {
  items: CodeSearchItem[];
}

// --- Helpers ---

async function searchZentralRepos(
  qualifier: string,
): Promise<CodeSearchItem[]> {
  const { fetch } = await import("@tauri-apps/plugin-http");
  const { tauriInvoke } = await import("@/lib/tauri");
  const token = await tauriInvoke<string>("get_github_token");

  const q = encodeURIComponent(`filename:.zentral.json ${qualifier}`);
  const res = await fetch(
    `https://api.github.com/search/code?q=${q}&per_page=30`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!res.ok) {
    if (res.status === 403 || res.status === 429) {
      throw new GithubError("RateLimited", "GitHub search rate limit reached", res.status);
    }
    throw new GithubError("Unknown", res.statusText, res.status);
  }

  const data = (await res.json()) as CodeSearchResult;
  return data.items;
}

function dedupeByFullName(items: CodeSearchItem[]): CodeSearchItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.repository.full_name)) return false;
    seen.add(item.repository.full_name);
    return true;
  });
}

// --- Component ---

interface FindOnGitHubDialogProps {
  trigger?: React.ReactNode;
}

export function FindOnGitHubDialog({ trigger }: FindOnGitHubDialogProps) {
  const { addOrUpdateProject } = useZentral();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CodeSearchItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    setSelected(new Set());

    try {
      const user = await getAuthenticatedUser();
      const orgs = await getUserOrgs();

      const queries = [
        `user:${user.login}`,
        ...orgs.map((o) => `org:${o.login}`),
      ];

      const batches = await Promise.allSettled(
        queries.map((q) => searchZentralRepos(q)),
      );

      const allItems: CodeSearchItem[] = [];
      for (const result of batches) {
        if (result.status === "fulfilled") {
          allItems.push(...result.value);
        }
      }

      const deduped = dedupeByFullName(allItems);
      setResults(deduped);

      const rateLimited = batches.some(
        (r) =>
          r.status === "rejected" &&
          r.reason instanceof GithubError &&
          r.reason.kind === "RateLimited",
      );
      if (rateLimited) {
        setError(
          "Some searches were rate-limited by GitHub (10 req/30s). Results may be incomplete.",
        );
      }
    } catch (err) {
      if (err instanceof GithubError && err.kind === "RateLimited") {
        setError("GitHub search rate limit reached. Please wait 30 seconds and try again.");
      } else {
        setError(err instanceof Error ? err.message : "Search failed");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleSelect = (fullName: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(fullName) ? next.delete(fullName) : next.add(fullName);
      return next;
    });
  };

  const handleImport = useCallback(async () => {
    setImporting(true);
    try {
      const toImport = results.filter((r) => selected.has(r.repository.full_name));
      await Promise.all(
        toImport.map((item) => {
          const repo = item.repository;
          const repoName = repo.full_name.split("/")[1];
          const entry: ZentralProjectEntry = {
            id: crypto.randomUUID(),
            canonicalId: repo.full_name,
            name: repoName,
            localPath: null,
            remoteUrl: `https://github.com/${repo.full_name}.git`,
            repoFullName: repo.full_name,
            config: null,
            importedAt: new Date().toISOString(),
          };
          return addOrUpdateProject(entry);
        }),
      );
      setOpen(false);
    } finally {
      setImporting(false);
    }
  }, [results, selected, addOrUpdateProject]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <Github className="size-4" />
            Find on GitHub
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="size-5" />
            Find on GitHub
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            Search your GitHub repos for <code className="font-mono">.zentral.json</code> files.
          </p>

          <Button
            onClick={handleSearch}
            disabled={loading}
            className="gap-2 self-start"
            size="sm"
          >
            <Search className="size-4" />
            {loading ? "Searching…" : "Search"}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {results.length > 0 && (
            <>
              <p className="text-muted-foreground text-xs">
                {results.length} repo{results.length !== 1 ? "s" : ""} found.
                Note: some repos may not appear due to GitHub search indexing.
              </p>
              <ScrollArea className="h-60 rounded-md border">
                <div className="flex flex-col divide-y">
                  {results.map((item) => {
                    const repo = item.repository;
                    return (
                      <label
                        key={repo.full_name}
                        className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 p-3"
                      >
                        <Checkbox
                          checked={selected.has(repo.full_name)}
                          onCheckedChange={() => toggleSelect(repo.full_name)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {repo.full_name}
                          </p>
                          {repo.description && (
                            <p className="text-muted-foreground mt-0.5 truncate text-xs">
                              {repo.description}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}

          {!loading && results.length === 0 && !error && (
            <p className="text-muted-foreground text-sm">
              Click Search to find repos containing <code className="font-mono">.zentral.json</code>.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={selected.size === 0 || importing}
          >
            {importing ? "Importing…" : `Import ${selected.size > 0 ? selected.size : ""} repo${selected.size !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
