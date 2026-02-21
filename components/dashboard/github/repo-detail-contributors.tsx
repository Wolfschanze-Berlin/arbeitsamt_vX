"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRepoContributors } from "@/hooks/useGithub";
import { Users } from "lucide-react";

interface Props {
  owner: string;
  repo: string;
}

const MAX_SHOWN = 10;

export function RepoDetailContributors({ owner, repo }: Props) {
  const { data: contributors, isLoading } = useRepoContributors(owner, repo);

  return (
    <div className="rounded-2xl border bg-card p-5 md:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Users className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Contributors</h2>
      </div>

      {isLoading ? (
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-8 rounded-full" />
          ))}
        </div>
      ) : !contributors || contributors.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contributors found</p>
      ) : (
        <>
          <TooltipProvider>
            <div className="flex flex-wrap gap-2">
              {contributors.slice(0, MAX_SHOWN).map((contributor) => (
                <Tooltip key={contributor.login}>
                  <TooltipTrigger asChild>
                    <a
                      href={contributor.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2 ring-border transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-primary"
                    >
                      <img
                        src={contributor.avatar_url}
                        alt={contributor.login}
                        width={32}
                        height={32}
                        className="h-8 w-8 object-cover"
                      />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    <span className="font-medium">{contributor.login}</span>
                    {" — "}
                    <span>{contributor.contributions} contributions</span>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>

          <p className="mt-3 text-xs text-muted-foreground">
            {contributors.length === 1
              ? "1 contributor"
              : `${contributors.length} contributors`}
            {contributors.length > MAX_SHOWN
              ? ` (showing ${MAX_SHOWN})`
              : null}
          </p>
        </>
      )}
    </div>
  );
}
