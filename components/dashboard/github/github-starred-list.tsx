"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Fuse, { type IFuseOptions } from "fuse.js";
import { Search, Star, GitFork } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useUserStarredRepos } from "@/hooks/useGithub";
import { useSelectedRepo } from "@/context/selected-repo-context";
import type { GithubRepo } from "@/lib/github";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const PER_PAGE = 30;

const FUSE_OPTIONS: IFuseOptions<GithubRepo> = {
  keys: [
    { name: "name", weight: 0.3 },
    { name: "full_name", weight: 0.3 },
    { name: "description", weight: 0.25 },
    { name: "language", weight: 0.15 },
  ],
  threshold: 0.4,
  ignoreLocation: true,
};

function StarredTableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-10" /></TableCell>
          <TableCell><Skeleton className="h-4 w-10" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function GithubStarredList() {
  const router = useRouter();
  const { setSelectedRepo } = useSelectedRepo();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const { data: repos, isLoading, error } = useUserStarredRepos(page, PER_PAGE);

  const handleRowClick = useCallback(
    (repo: GithubRepo) => {
      setSelectedRepo(repo);
      router.push("/github/starred/detail");
    },
    [setSelectedRepo, router],
  );

  const fuse = useMemo(
    () => (repos ? new Fuse(repos, FUSE_OPTIONS) : null),
    [repos],
  );

  const filteredRepos = useMemo(() => {
    if (!repos) return undefined;
    if (!query.trim()) return repos;
    return fuse?.search(query).map((r) => r.item) ?? repos;
  }, [repos, query, fuse]);

  const hasMore = repos?.length === PER_PAGE;

  return (
    <div className="rounded-2xl border bg-card p-5 md:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          Starred Repositories
        </h3>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search starred repos..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {error && !repos && (
        <p className="text-sm text-muted-foreground">
          Failed to load starred repositories.
        </p>
      )}

      <div className="max-w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Description</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Stars</TableHead>
              <TableHead>Forks</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && !repos ? (
              <StarredTableSkeleton />
            ) : filteredRepos?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  {query ? "No repos match your search." : "No starred repositories yet."}
                </TableCell>
              </TableRow>
            ) : (
              filteredRepos?.map((repo) => (
                <TableRow
                  key={repo.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(repo)}
                >
                  <TableCell className="font-medium text-foreground">
                    {repo.full_name}
                  </TableCell>
                  <TableCell className="hidden md:table-cell max-w-xs truncate text-sm text-muted-foreground">
                    {repo.description ?? "--"}
                  </TableCell>
                  <TableCell>
                    {repo.language ? (
                      <Badge variant="secondary" className="gap-1.5 text-xs">
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
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                      <GitFork className="size-3.5" />
                      {repo.forks_count}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {repo.updated_at
                      ? formatDistanceToNow(new Date(repo.updated_at), {
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

      <div className="mt-4 flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || isLoading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">Page {page}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasMore || isLoading}
          onClick={() => setPage((p) => p + 1)}
        >
          {isLoading ? "Loading..." : "Next"}
        </Button>
      </div>
    </div>
  );
}
