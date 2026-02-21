"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  Star,
  GitFork,
  CircleDot,
  GitPullRequest,
  ExternalLink,
  Terminal,
  Loader2,
  AlertCircle,
  FolderGit2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  getRepoReadme,
  getRepoIssues,
  getRepoPRs,
  type GithubRepo,
  type GithubReadme,
} from "@/lib/github";
import { tauriInvoke } from "@/lib/tauri";
import type { ZentralProjectEntry } from "@/lib/zentral/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function getRepo(owner: string, repo: string): Promise<GithubRepo> {
  const { fetch } = await import("@tauri-apps/plugin-http");
  const token = await tauriInvoke<string>("get_github_token");
  const res = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json() as Promise<GithubRepo>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface OverviewTabProps {
  project: ZentralProjectEntry;
}

interface RepoData {
  repo: GithubRepo;
  readme: GithubReadme | null;
  issueCount: number;
  prCount: number;
}

export function OverviewTab({ project }: OverviewTabProps) {
  const [data, setData] = useState<RepoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { repoFullName, localPath } = project;

  useEffect(() => {
    if (!repoFullName) return;

    const [owner, repo] = repoFullName.split("/");
    if (!owner || !repo) return;

    setLoading(true);
    setError(null);

    Promise.all([
      getRepo(owner, repo),
      getRepoReadme(owner, repo).catch(() => null),
      getRepoIssues(owner, repo).catch(() => [] as never[]),
      getRepoPRs(owner, repo).catch(() => [] as never[]),
    ])
      .then(([repoData, readme, issues, prs]) => {
        setData({
          repo: repoData,
          readme,
          issueCount: issues.length,
          prCount: prs.length,
        });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load repo data");
      })
      .finally(() => setLoading(false));
  }, [repoFullName]);

  // --- No repo linked ---
  if (!repoFullName) {
    return (
      <Alert>
        <FolderGit2 className="size-4" />
        <AlertDescription>No GitHub repo linked to this project.</AlertDescription>
      </Alert>
    );
  }

  // --- Loading ---
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground size-8 animate-spin" />
      </div>
    );
  }

  // --- Error ---
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const { repo, readme, issueCount, prCount } = data;
  const readmeExcerpt = readme?.content.slice(0, 500) ?? null;

  return (
    <div className="flex flex-col gap-6">
      {/* Metadata card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{repo.full_name}</CardTitle>
          {repo.description && (
            <p className="text-muted-foreground text-sm">{repo.description}</p>
          )}
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {repo.language && (
            <Badge variant="secondary">{repo.language}</Badge>
          )}
          <span className="text-muted-foreground flex items-center gap-1 text-sm">
            <Star className="size-3.5" />
            {repo.stargazers_count.toLocaleString()}
          </span>
          <span className="text-muted-foreground flex items-center gap-1 text-sm">
            <GitFork className="size-3.5" />
            {repo.forks_count.toLocaleString()}
          </span>
          <Separator orientation="vertical" className="h-4" />
          <span className="text-muted-foreground text-sm">
            Pushed {formatDate(repo.pushed_at)}
          </span>
        </CardContent>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <CircleDot className="text-muted-foreground size-5 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{issueCount}</p>
              <p className="text-muted-foreground text-xs">Open issues</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <GitPullRequest className="text-muted-foreground size-5 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{prCount}</p>
              <p className="text-muted-foreground text-xs">Open PRs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* README excerpt */}
      {readmeExcerpt && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">README</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none overflow-hidden">
              <ReactMarkdown>{readmeExcerpt}</ReactMarkdown>
            </div>
            {readme && readme.content.length > 500 && (
              <a
                href={readme.html_url}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground mt-2 inline-block text-xs underline-offset-4 hover:underline"
              >
                View full README on GitHub
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {/* Links */}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <a
            href={repo.html_url}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="mr-2 size-4" />
            Open on GitHub
          </a>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={
            project.config?.servers?.[0]
              ? `/ssh?host=${encodeURIComponent(project.config.servers[0].sshAlias)}&autoConnect=true${
                  project.config.servers[0].repoPath
                    ? `&path=${encodeURIComponent(project.config.servers[0].repoPath)}`
                    : ""
                }`
              : "/ssh"
          }>
            <Terminal className="mr-2 size-4" />
            Open in Terminal
          </Link>
        </Button>
      </div>
    </div>
  );
}
