"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRepoIssues } from "@/hooks/useGithub";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface Props {
  owner: string;
  repo: string;
}

export function RepoDetailIssues({ owner, repo }: Props) {
  const { data: issues, isLoading } = useRepoIssues(owner, repo);

  return (
    <div className="rounded-2xl border bg-card p-5 md:p-6">
      <div className="mb-4 flex items-center gap-2">
        <AlertCircle className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Open Issues</h2>
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
      ) : !issues || issues.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-green-500" />
          No open issues
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {issues.map((issue) => (
            <li key={issue.number} className="py-3">
              <p className="text-sm font-medium text-foreground">
                #{issue.number} {issue.title}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {issue.labels.map((label) => (
                  <Badge
                    key={label.name}
                    variant="outline"
                    className="px-1.5 py-0 text-xs"
                    style={{ borderColor: `#${label.color}`, color: `#${label.color}` }}
                  >
                    {label.name}
                  </Badge>
                ))}
                <span className="text-xs text-muted-foreground">
                  opened by {issue.user.login}{" "}
                  {formatDistanceToNow(new Date(issue.created_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
