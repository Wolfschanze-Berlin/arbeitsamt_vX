"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRepoPRs } from "@/hooks/useGithub";
import { formatDistanceToNow } from "date-fns";
import { GitPullRequest } from "lucide-react";

interface Props {
  owner: string;
  repo: string;
}

export function RepoDetailPRs({ owner, repo }: Props) {
  const { data: prs, isLoading } = useRepoPRs(owner, repo);

  return (
    <div className="rounded-2xl border bg-card p-5 md:p-6">
      <div className="mb-4 flex items-center gap-2">
        <GitPullRequest className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Open Pull Requests</h2>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : !prs || prs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open pull requests</p>
      ) : (
        <ul className="divide-y divide-border">
          {prs.map((pr) => (
            <li key={pr.number} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">
                  #{pr.number} {pr.title}
                </p>
                {pr.draft && (
                  <Badge variant="secondary" className="text-xs">
                    Draft
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                opened by {pr.user.login}{" "}
                {formatDistanceToNow(new Date(pr.created_at), {
                  addSuffix: true,
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
