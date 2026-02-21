"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Loader2,
  AlertCircle,
  RefreshCw,
  HardDrive,
  Server,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { tauriInvoke } from "@/lib/tauri";
import type { ZentralProjectEntry } from "@/lib/zentral/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FsEntry {
  name: string;
  isDir: boolean;
  path: string;
}

interface TreeNode extends FsEntry {
  children: TreeNode[] | null; // null = not yet loaded; [] = loaded but empty
  loading: boolean;
  expanded: boolean;
}

// ─── Data sources ─────────────────────────────────────────────────────────────

async function listLocalDir(path: string): Promise<FsEntry[]> {
  const { readDir } = await import("@tauri-apps/plugin-fs");
  const entries = await readDir(path);
  return entries
    .map((e) => ({
      name: e.name ?? "",
      isDir: e.isDirectory ?? false,
      path: `${path}${path.endsWith("/") || path.endsWith("\\") ? "" : "/"}${e.name}`,
    }))
    .filter((e) => e.name !== "")
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

async function listRemoteDir(host: string, path: string): Promise<FsEntry[]> {
  const entries = await tauriInvoke<Array<{ name: string; is_dir: boolean; path: string }>>(
    "zentral_list_remote_dir",
    { host, path },
  );
  return entries.map((e) => ({ name: e.name, isDir: e.is_dir, path: e.path }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildNode(entry: FsEntry): TreeNode {
  return {
    ...entry,
    children: entry.isDir ? null : [],
    loading: false,
    expanded: false,
  };
}

function applyToNode(
  nodes: TreeNode[],
  targetPath: string,
  updater: (n: TreeNode) => TreeNode,
): TreeNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath) return updater(node);
    if (node.children) {
      return { ...node, children: applyToNode(node.children, targetPath, updater) };
    }
    return node;
  });
}

function findNode(nodes: TreeNode[], p: string): TreeNode | null {
  for (const n of nodes) {
    if (n.path === p) return n;
    if (n.children) {
      const found = findNode(n.children, p);
      if (found) return found;
    }
  }
  return null;
}

// ─── TreeRow ─────────────────────────────────────────────────────────────────

interface TreeRowProps {
  node: TreeNode;
  depth: number;
  onToggle: (path: string) => void;
}

function TreeRow({ node, depth, onToggle }: TreeRowProps) {
  const indent = depth * 16;

  return (
    <>
      <div
        className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-sm ${
          node.isDir
            ? "cursor-pointer hover:bg-accent"
            : "text-muted-foreground cursor-default"
        }`}
        style={{ paddingLeft: `${indent + 8}px` }}
        onClick={() => node.isDir && onToggle(node.path)}
      >
        <span className="shrink-0 size-3.5 flex items-center justify-center">
          {node.isDir &&
            (node.loading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : node.expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            ))}
        </span>

        {node.isDir ? (
          node.expanded ? (
            <FolderOpen className="shrink-0 size-4 text-amber-400" />
          ) : (
            <Folder className="shrink-0 size-4 text-amber-400" />
          )
        ) : (
          <FileText className="shrink-0 size-4" />
        )}

        <span className="truncate leading-5">{node.name}</span>
      </div>

      {node.expanded && node.children && node.children.length > 0 && (
        <>
          {node.children.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              onToggle={onToggle}
            />
          ))}
        </>
      )}

      {node.expanded && node.children && node.children.length === 0 && (
        <div
          className="py-0.5 text-xs text-muted-foreground italic"
          style={{ paddingLeft: `${indent + 36}px` }}
        >
          Empty folder
        </div>
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface FilesTabProps {
  project: ZentralProjectEntry;
}

export function FilesTab({ project }: FilesTabProps) {
  const [roots, setRoots] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { localPath, config } = project;

  // Determine source: local clone takes priority, then first server with repoPath
  const remoteServer = !localPath
    ? config?.servers?.find((s) => s.repoPath)
    : undefined;
  const isRemote = Boolean(remoteServer);
  const rootPath = localPath ?? remoteServer?.repoPath ?? null;
  const remoteHost = remoteServer?.sshAlias ?? null;

  const loadRoot = useCallback(async () => {
    if (!rootPath) return;
    setLoading(true);
    setError(null);
    try {
      const entries = isRemote && remoteHost
        ? await listRemoteDir(remoteHost, rootPath)
        : await listLocalDir(rootPath);
      setRoots(entries.map(buildNode));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read directory");
    } finally {
      setLoading(false);
    }
  }, [rootPath, isRemote, remoteHost]);

  useEffect(() => {
    loadRoot();
  }, [loadRoot]);

  async function handleToggle(path: string) {
    const node = findNode(roots, path);
    if (!node) return;

    if (node.expanded) {
      setRoots((prev) => applyToNode(prev, path, (n) => ({ ...n, expanded: false })));
      return;
    }

    if (node.children === null) {
      setRoots((prev) => applyToNode(prev, path, (n) => ({ ...n, loading: true })));
      try {
        const entries = isRemote && remoteHost
          ? await listRemoteDir(remoteHost, path)
          : await listLocalDir(path);
        setRoots((prev) =>
          applyToNode(prev, path, (n) => ({
            ...n,
            loading: false,
            expanded: true,
            children: entries.map(buildNode),
          })),
        );
      } catch {
        setRoots((prev) => applyToNode(prev, path, (n) => ({ ...n, loading: false, children: [] })));
      }
    } else {
      setRoots((prev) => applyToNode(prev, path, (n) => ({ ...n, expanded: true })));
    }
  }

  // ── No path available ──────────────────────────────────────────────────────

  if (!rootPath) {
    return (
      <Alert>
        <HardDrive className="size-4" />
        <AlertDescription>
          No local clone and no server path configured for this project.
        </AlertDescription>
      </Alert>
    );
  }

  // ── Loading root ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground size-8 animate-spin" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col gap-3">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" size="sm" className="w-fit" onClick={loadRoot}>
          <RefreshCw className="mr-2 size-4" />
          Retry
        </Button>
      </div>
    );
  }

  // ── Tree ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground font-mono text-xs truncate max-w-[calc(100%-3rem)] flex items-center gap-1.5">
          {isRemote && <Server className="size-3 shrink-0" />}
          {isRemote ? `${remoteHost}:${rootPath}` : rootPath}
        </p>
        <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={loadRoot} title="Refresh">
          <RefreshCw className="size-3.5" />
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-16rem)] rounded-md border">
        <div className="py-1">
          {roots.length === 0 ? (
            <p className="text-muted-foreground px-4 py-8 text-center text-sm">
              Empty repository
            </p>
          ) : (
            roots.map((node) => (
              <TreeRow
                key={node.path}
                node={node}
                depth={0}
                onToggle={handleToggle}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
