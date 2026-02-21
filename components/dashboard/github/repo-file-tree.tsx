"use client";

import { useState } from "react";
import {
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  Loader2,
} from "lucide-react";
import { useRepoContents } from "@/hooks/useGithub";
import type { GithubContent } from "@/lib/github";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Sort: directories first, then files, alphabetically within each group
// ---------------------------------------------------------------------------

function sortContents(items: GithubContent[]): GithubContent[] {
  return [...items].sort((a, b) => {
    if (a.type === "dir" && b.type !== "dir") return -1;
    if (a.type !== "dir" && b.type === "dir") return 1;
    return a.name.localeCompare(b.name);
  });
}

// ---------------------------------------------------------------------------
// Lazy-loaded directory row (fetches on expand)
// ---------------------------------------------------------------------------

function DirectoryRow({
  owner,
  repo,
  item,
  depth,
}: {
  owner: string;
  repo: string;
  item: GithubContent;
  depth: number;
}) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useRepoContents(
    open ? owner : null,
    open ? repo : null,
    item.path,
  );

  return (
    <>
      <button
        type="button"
        className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm hover:bg-muted/50"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronRight
          className="size-3.5 shrink-0 text-muted-foreground transition-transform"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        />
        {open ? (
          <FolderOpen className="size-4 shrink-0 text-blue-500" />
        ) : (
          <Folder className="size-4 shrink-0 text-blue-500" />
        )}
        <span className="truncate text-foreground">{item.name}</span>
      </button>

      {open && isLoading && (
        <div
          className="flex items-center gap-2 px-2 py-1"
          style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
        >
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Loading...</span>
        </div>
      )}

      {open &&
        data &&
        sortContents(data).map((child) =>
          child.type === "dir" ? (
            <DirectoryRow
              key={child.sha}
              owner={owner}
              repo={repo}
              item={child}
              depth={depth + 1}
            />
          ) : (
            <FileRow key={child.sha} item={child} depth={depth + 1} />
          ),
        )}
    </>
  );
}

// ---------------------------------------------------------------------------
// File row (leaf node)
// ---------------------------------------------------------------------------

function FileRow({ item, depth }: { item: GithubContent; depth: number }) {
  return (
    <a
      href={item.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm hover:bg-muted/50"
      style={{ paddingLeft: `${depth * 16 + 8 + 18}px` }}
    >
      <File className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate text-foreground">{item.name}</span>
      {item.size > 0 && (
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {formatSize(item.size)}
        </span>
      )}
    </a>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

function TreeSkeleton() {
  return (
    <div className="space-y-1.5 p-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-5 w-full" style={{ maxWidth: `${60 + Math.random() * 40}%` }} />
      ))}
    </div>
  );
}

interface RepoFileTreeProps {
  owner: string;
  repo: string;
}

export function RepoFileTree({ owner, repo }: RepoFileTreeProps) {
  const { data, isLoading, error } = useRepoContents(owner, repo);

  return (
    <div className="rounded-2xl border bg-card p-5 md:p-6">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Files</h3>

      {error && (
        <p className="text-sm text-muted-foreground">
          Failed to load file tree.
        </p>
      )}

      {isLoading && !data ? (
        <TreeSkeleton />
      ) : data ? (
        <div className="max-h-[480px] overflow-y-auto">
          {sortContents(data).map((item) =>
            item.type === "dir" ? (
              <DirectoryRow
                key={item.sha}
                owner={owner}
                repo={repo}
                item={item}
                depth={0}
              />
            ) : (
              <FileRow key={item.sha} item={item} depth={0} />
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
