"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useRepoCommits } from "@/hooks/useGithub";
import { formatDistanceToNow } from "date-fns";
import { GitCommit } from "lucide-react";

interface Props {
  owner: string;
  repo: string;
}

async function openUrl(url: string) {
  try {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function RepoDetailCommits({ owner, repo }: Props) {
  const { data: commits, isLoading } = useRepoCommits(owner, repo);

  return (
    <div className="rounded-2xl border bg-card p-5 md:p-6">
      <div className="mb-4 flex items-center gap-2">
        <GitCommit className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Recent Commits</h2>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-14 shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24 shrink-0" />
              <Skeleton className="h-4 w-20 shrink-0" />
            </div>
          ))}
        </div>
      ) : !commits || commits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No commits found</p>
      ) : (
        <div className="divide-y divide-border">
          {commits.map((commit) => {
            const message = commit.commit.message.split("\n")[0];
            const truncated =
              message.length > 72 ? message.slice(0, 72) + "…" : message;
            const author =
              commit.author?.login ?? commit.commit.author.name;
            const date = formatDistanceToNow(
              new Date(commit.commit.author.date),
              { addSuffix: true },
            );

            return (
              <div
                key={commit.sha}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm"
              >
                <button
                  type="button"
                  onClick={() => openUrl(commit.html_url)}
                  className="font-mono text-xs text-primary underline-offset-2 hover:underline"
                >
                  {commit.sha.slice(0, 7)}
                </button>
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {truncated}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {author}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {date}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
