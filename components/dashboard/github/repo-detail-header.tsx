"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GithubRepo } from "@/lib/github";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  ExternalLink,
  GitBranch,
  GitFork,
  Lock,
  Star,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Language color map (matches github-repo-list.tsx)
// ---------------------------------------------------------------------------

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "bg-blue-500",
  JavaScript: "bg-yellow-400",
  Rust: "bg-orange-600",
  Python: "bg-green-500",
  Go: "bg-cyan-500",
  Java: "bg-red-500",
  "C++": "bg-pink-500",
  C: "bg-gray-500",
  Ruby: "bg-red-700",
  Shell: "bg-emerald-500",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RepoDetailHeaderProps {
  repo: GithubRepo;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RepoDetailHeader({ repo }: RepoDetailHeaderProps) {
  const [owner, repoName] = repo.full_name.split("/");

  async function handleOpenGitHub() {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(repo.html_url);
    } catch {
      // Fallback for dev environment where Tauri shell plugin is unavailable
      window.open(repo.html_url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-5 md:p-6">
      {/* Title row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">{repoName}</h1>
            {repo.private && (
              <Lock className="size-4 shrink-0 text-muted-foreground" />
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{owner}</p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={handleOpenGitHub}
        >
          <ExternalLink className="size-4" />
          Open on GitHub
        </Button>
      </div>

      {/* Description */}
      {repo.description && (
        <p className="mt-3 text-sm text-muted-foreground">{repo.description}</p>
      )}

      {/* Stats row */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {repo.language && (
          <Badge variant="secondary" className="gap-1.5 text-xs">
            <span
              className={`inline-block size-2 rounded-full ${
                LANGUAGE_COLORS[repo.language] ?? "bg-muted-foreground"
              }`}
            />
            {repo.language}
          </Badge>
        )}

        <Badge variant="outline" className="gap-1.5 text-xs">
          <Star className="size-3.5" />
          {repo.stargazers_count.toLocaleString()}
        </Badge>

        <Badge variant="outline" className="gap-1.5 text-xs">
          <GitFork className="size-3.5" />
          {repo.forks_count.toLocaleString()}
        </Badge>

        <Badge variant="outline" className="gap-1.5 text-xs">
          <AlertCircle className="size-3.5" />
          {repo.open_issues_count.toLocaleString()} open issues
        </Badge>

        <Badge variant="outline" className="gap-1.5 text-xs">
          <GitBranch className="size-3.5" />
          {repo.default_branch}
        </Badge>
      </div>

      {/* Timestamps */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>
          Created{" "}
          {formatDistanceToNow(new Date(repo.created_at), { addSuffix: true })}
        </span>
        <span>
          Updated{" "}
          {formatDistanceToNow(new Date(repo.updated_at), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}
