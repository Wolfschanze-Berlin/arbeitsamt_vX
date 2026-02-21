"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Trash2,
  Save,
  ExternalLink,
  FolderOpen,
  Terminal,
  CheckCircle,
  XCircle,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useZentral } from "@/context/ZentralContext";
import { tauriInvoke, tauriListen } from "@/lib/tauri";
import type { ZentralProjectEntry } from "@/lib/zentral/types";

type CloneStatus = "idle" | "running" | "done" | "error";

// ─── Component ────────────────────────────────────────────────────────────────

interface SettingsTabProps {
  project: ZentralProjectEntry;
}

export function SettingsTab({ project }: SettingsTabProps) {
  const router = useRouter();
  const { addOrUpdateProject, deleteProject } = useZentral();

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(
    project.config?.description ?? "",
  );
  const [remoteUrl, setRemoteUrl] = useState(project.remoteUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);

  // Re-clone state
  const [localPath, setLocalPath] = useState(project.localPath ?? "");
  const [cloneStatus, setCloneStatus] = useState<CloneStatus>("idle");
  const [logLines, setLogLines] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const addLogLine = useCallback((line: string) => {
    setLogLines((prev) => [...prev, line]);
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logLines]);

  // Event cleanup ref — listeners are registered in handleReclone, not useEffect
  const cleanupRef = useRef<Array<() => void>>([]);
  useEffect(() => {
    return () => cleanupRef.current.forEach((fn) => fn());
  }, []);

  async function pickFolder() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const dir = await open({ directory: true, multiple: false });
      if (typeof dir === "string" && dir) {
        const sep = dir.includes("\\") ? "\\" : "/";
        setLocalPath(`${dir}${sep}${project.name}`);
      }
    } catch {
      // Cancelled — no-op
    }
  }

  async function handleReclone() {
    const repoUrl = remoteUrl.trim() || project.remoteUrl;
    if (!repoUrl || !localPath.trim()) return;

    // Clean up previous listeners
    cleanupRef.current.forEach((fn) => fn());
    cleanupRef.current = [];

    setCloneStatus("running");
    setLogLines([]);

    // Register event listeners BEFORE invoking the command to avoid race
    const [unProgress, unComplete] = await Promise.all([
      tauriListen<{ line: string }>("zentral://clone-progress", (p) => {
        addLogLine(p.line);
      }),
      tauriListen<{ path: string }>("zentral://clone-complete", () => {
        setCloneStatus("done");
      }),
    ]);
    cleanupRef.current = [unProgress, unComplete];

    try {
      await tauriInvoke("zentral_clone_project", {
        repoUrl,
        localPath: localPath.trim(),
      });
      // Update stored localPath on success
      await addOrUpdateProject({ ...project, localPath: localPath.trim() });
    } catch (e) {
      setCloneStatus("error");
      const msg = e instanceof Error ? e.message : String(e);
      addLogLine(`Error: ${msg}`);
    }
  }

  const hasChanges =
    name !== project.name ||
    description !== (project.config?.description ?? "") ||
    remoteUrl !== (project.remoteUrl ?? "");

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const updated: ZentralProjectEntry = {
        ...project,
        name: name.trim(),
        remoteUrl: remoteUrl.trim() || null,
        config: project.config
          ? { ...project.config, name: name.trim(), description: description.trim() || undefined }
          : null,
      };
      await addOrUpdateProject(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteProject(project.id);
      router.push("/zentral");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* General settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">General</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My project"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short description of this project"
              className="min-h-20 resize-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="remote-url">Remote URL</Label>
            <div className="flex gap-2">
              <Input
                id="remote-url"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="flex-1 font-mono text-sm"
              />
              {remoteUrl && (
                <Button variant="ghost" size="icon" asChild className="shrink-0">
                  <a href={remoteUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || !name.trim() || saving}
            >
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              {saved ? "Saved" : "Save changes"}
            </Button>
            {saved && (
              <span className="text-xs text-green-500">Changes saved</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Local clone */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Local clone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="local-path">Clone directory</Label>
            <div className="flex gap-2">
              <Input
                id="local-path"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                placeholder="/home/user/projects/my-project"
                className="flex-1 font-mono text-sm"
                disabled={cloneStatus === "running"}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={pickFolder}
                disabled={cloneStatus === "running"}
                title="Choose folder"
              >
                <FolderOpen className="size-4" />
              </Button>
            </div>
            {!remoteUrl.trim() && !project.remoteUrl && (
              <p className="text-xs text-amber-500">
                Set a remote URL above before cloning.
              </p>
            )}
          </div>

          <Button
            size="sm"
            className="w-fit"
            onClick={handleReclone}
            disabled={
              !localPath.trim() ||
              (!remoteUrl.trim() && !project.remoteUrl) ||
              cloneStatus === "running" ||
              cloneStatus === "done"
            }
          >
            {cloneStatus === "running" ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <GitBranch className="mr-2 size-4" />
            )}
            {cloneStatus === "done" ? "Cloned" : "Clone"}
          </Button>

          {(cloneStatus === "running" ||
            cloneStatus === "done" ||
            cloneStatus === "error") && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Terminal className="size-4" />
                Clone output
                {cloneStatus === "done" && (
                  <CheckCircle className="size-4 text-green-500" />
                )}
                {cloneStatus === "error" && (
                  <XCircle className="text-destructive size-4" />
                )}
              </div>
              <ScrollArea className="bg-muted h-40 rounded-md border p-3 font-mono text-xs">
                {logLines.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap break-all leading-5">
                    {line}
                  </div>
                ))}
                {cloneStatus === "running" && (
                  <div className="mt-1 animate-pulse text-muted-foreground">▌</div>
                )}
                <div ref={bottomRef} />
              </ScrollArea>
              {cloneStatus === "done" && (
                <p className="text-xs text-green-500">
                  Cloned to {localPath}
                </p>
              )}
              {cloneStatus === "error" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => setCloneStatus("idle")}
                >
                  Dismiss
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Read-only info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Info</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">ID</dt>
            <dd className="truncate font-mono text-xs">{project.id}</dd>

            <dt className="text-muted-foreground">Canonical ID</dt>
            <dd className="truncate font-mono text-xs">{project.canonicalId}</dd>

            {project.repoFullName && (
              <>
                <dt className="text-muted-foreground">GitHub repo</dt>
                <dd className="truncate">{project.repoFullName}</dd>
              </>
            )}

            <dt className="text-muted-foreground">Local path</dt>
            <dd className="flex items-center gap-1 truncate font-mono text-xs">
              {project.localPath ? (
                <>
                  <FolderOpen className="size-3 shrink-0" />
                  {project.localPath}
                </>
              ) : (
                <span className="text-muted-foreground italic">Not cloned</span>
              )}
            </dd>

            <dt className="text-muted-foreground">Imported</dt>
            <dd>
              {new Date(project.importedAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </dd>

            <dt className="text-muted-foreground">Config version</dt>
            <dd>{project.config?.version ?? "—"}</dd>
          </dl>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Separator />

      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-destructive text-base">Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            Remove this project from Die Zentral. This does not delete the local
            files or the GitHub repository — only the project entry.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="w-fit">
                <Trash2 className="mr-2 size-4" />
                Remove project
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove project?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove <strong>{project.name}</strong> from Die
                  Zentral. Local files and the GitHub repository will not be
                  affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
