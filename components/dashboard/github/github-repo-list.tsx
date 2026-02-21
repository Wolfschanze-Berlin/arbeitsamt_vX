"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useUserRepos } from "@/hooks/useGithub";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

const PER_PAGE = 10;

function RepoTableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-10" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function GithubRepoList() {
  const [page, setPage] = useState(1);
  const { data: repos, isLoading, error } = useUserRepos(page, PER_PAGE);

  const hasMore = repos?.length === PER_PAGE;

  return (
    <div className="rounded-2xl border bg-card p-5 md:p-6">
      <h3 className="mb-4 text-lg font-semibold text-foreground">
        Repositories
      </h3>

      {error && !repos && (
        <p className="text-sm text-muted-foreground">
          Failed to load repositories.
        </p>
      )}

      <div className="max-w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Stars</TableHead>
              <TableHead>Last Push</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && !repos ? (
              <RepoTableSkeleton />
            ) : (
              repos?.map((repo) => (
                <TableRow key={repo.id}>
                  <TableCell className="font-medium text-foreground">
                    {repo.name}
                  </TableCell>
                  <TableCell>
                    {repo.language ? (
                      <Badge
                        variant="secondary"
                        className="gap-1.5 text-xs"
                      >
                        <span
                          className={`inline-block size-2 rounded-full ${
                            LANGUAGE_COLORS[repo.language] ?? "bg-muted-foreground"
                          }`}
                        />
                        {repo.language}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                      <Star className="size-3.5" />
                      {repo.stargazers_count}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {repo.pushed_at
                      ? formatDistanceToNow(new Date(repo.pushed_at), {
                          addSuffix: true,
                        })
                      : "--"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={() => setPage((p) => p + 1)}
          >
            {isLoading ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
