"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRepoReleases } from "@/hooks/useGithub";
import { ChevronDown, ExternalLink, Tag } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

interface Props {
  owner: string;
  repo: string;
  defaultOpen?: boolean;
}

export function RepoDetailReleases({
  owner,
  repo,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const { data: releases, isLoading, error } = useRepoReleases(owner, repo);

  const hasReleases = !error && releases && releases.length > 0;

  return (
    <div className="rounded-2xl border bg-card">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-5 text-left md:p-6">
          <div className="flex items-center gap-2">
            <Tag className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Releases</span>
            {!isLoading && !hasReleases && (
              <span className="text-xs text-muted-foreground">
                — No releases found
              </span>
            )}
            {!isLoading && hasReleases && (
              <span className="text-xs text-muted-foreground">
                ({releases.length})
              </span>
            )}
          </div>
          {(isLoading || hasReleases) && (
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-200"
              style={{
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          )}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-5 py-4 md:px-6">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="ml-auto h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : hasReleases ? (
              <div className="space-y-3">
                {releases.map((release) => (
                  <a
                    key={release.id}
                    href={release.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                  >
                    <Badge variant="outline" className="shrink-0 font-mono">
                      {release.tag_name}
                    </Badge>
                    <span className="truncate text-foreground">
                      {release.name || release.tag_name}
                    </span>
                    {release.prerelease && (
                      <Badge
                        variant="secondary"
                        className="shrink-0 text-xs text-yellow-600 dark:text-yellow-400"
                      >
                        pre-release
                      </Badge>
                    )}
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {release.published_at
                        ? formatDistanceToNow(
                            new Date(release.published_at),
                            { addSuffix: true },
                          )
                        : "—"}
                    </span>
                    <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
