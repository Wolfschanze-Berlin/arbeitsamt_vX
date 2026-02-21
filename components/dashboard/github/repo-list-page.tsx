"use client";

import { useRouter } from "next/navigation";
import { Star, GitFork, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useUserRepos } from "@/hooks/useGithub";
import { useSelectedRepo } from "@/context/selected-repo-context";
import type { GithubRepo } from "@/lib/github";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
// Skeleton rows
// ---------------------------------------------------------------------------

function RepoTableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-40" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-10" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-10" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-10" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-28" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RepoListPage() {
  const router = useRouter();
  const { setSelectedRepo } = useSelectedRepo();
  const { data: repos, isLoading, error } = useUserRepos(1, 20);

  function handleRowClick(repo: GithubRepo) {
    setSelectedRepo(repo);
    router.push("/github/repo-detail");
  }

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6">
      <div className="rounded-2xl border bg-card p-5 md:p-6">
        <h2 className="mb-4 text-xl font-semibold text-foreground">
          Repositories
        </h2>

        {error && !repos && (
          <div className="flex items-center gap-2 text-sm text-destructive mb-4">
            <AlertCircle className="size-4 shrink-0" />
            <span>Failed to load repositories.</span>
          </div>
        )}

        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-3.5" />
                    Stars
                  </span>
                </TableHead>
                <TableHead>
                  <span className="inline-flex items-center gap-1">
                    <GitFork className="size-3.5" />
                    Forks
                  </span>
                </TableHead>
                <TableHead>
                  <span className="inline-flex items-center gap-1">
                    <AlertCircle className="size-3.5" />
                    Issues
                  </span>
                </TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && !repos ? (
                <RepoTableSkeleton />
              ) : (
                repos?.map((repo) => (
                  <TableRow
                    key={repo.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleRowClick(repo)}
                  >
                    <TableCell className="font-medium text-foreground">
                      {repo.name}
                    </TableCell>
                    <TableCell>
                      {repo.language ? (
                        <Badge variant="secondary" className="gap-1.5 text-xs">
                          <span
                            className={`inline-block size-2 rounded-full ${
                              LANGUAGE_COLORS[repo.language] ??
                              "bg-muted-foreground"
                            }`}
                          />
                          {repo.language}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          --
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {repo.stargazers_count}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {repo.forks_count}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {repo.open_issues_count}
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
      </div>
    </div>
  );
}
