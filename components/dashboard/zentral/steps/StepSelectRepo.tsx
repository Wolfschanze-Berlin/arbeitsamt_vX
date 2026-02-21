"use client";

import { useState, useEffect } from "react";
import { Search, Lock, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getUserRepos, type GithubRepo } from "@/lib/github";

export type RepoMode = "link" | "create";

export interface NewRepoForm {
  name: string;
  visibility: "public" | "private";
}

interface StepSelectRepoProps {
  mode: RepoMode;
  onModeChange: (m: RepoMode) => void;
  selectedRepo: GithubRepo | null;
  onRepoSelect: (r: GithubRepo) => void;
  newRepo: NewRepoForm;
  onNewRepoChange: (f: NewRepoForm) => void;
}

export function StepSelectRepo({
  mode,
  onModeChange,
  selectedRepo,
  onRepoSelect,
  newRepo,
  onNewRepoChange,
}: StepSelectRepoProps) {
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "link") return;
    setLoading(true);
    setError(null);
    getUserRepos(1, 100)
      .then(setRepos)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [mode]);

  const filtered = repos.filter((r) =>
    r.full_name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button
          variant={mode === "link" ? "default" : "outline"}
          size="sm"
          onClick={() => onModeChange("link")}
          className="flex-1"
        >
          Link existing repo
        </Button>
        <Button
          variant={mode === "create" ? "default" : "outline"}
          size="sm"
          onClick={() => onModeChange("create")}
          className="flex-1"
        >
          Create new repo
        </Button>
      </div>

      {mode === "link" && (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
            <Input
              placeholder="Search repositories…"
              className="pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {loading && (
            <p className="text-muted-foreground text-sm">Loading repos…</p>
          )}
          {error && <p className="text-destructive text-sm">{error}</p>}
          <ScrollArea className="h-52 rounded-md border">
            <div className="p-1">
              {filtered.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onRepoSelect(r)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                    selectedRepo?.id === r.id && "bg-accent",
                  )}
                >
                  {r.private ? (
                    <Lock className="text-muted-foreground size-3.5 shrink-0" />
                  ) : (
                    <Globe className="text-muted-foreground size-3.5 shrink-0" />
                  )}
                  <span className="truncate">{r.full_name}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {mode === "create" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-repo-name">Repository name</Label>
            <Input
              id="new-repo-name"
              placeholder="my-project"
              value={newRepo.name}
              onChange={(e) =>
                onNewRepoChange({ ...newRepo, name: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-repo-visibility">Visibility</Label>
            <Select
              value={newRepo.visibility}
              onValueChange={(v) =>
                onNewRepoChange({
                  ...newRepo,
                  visibility: v as "public" | "private",
                })
              }
            >
              <SelectTrigger id="new-repo-visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
