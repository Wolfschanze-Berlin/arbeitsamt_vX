"use client";

import { useEffect, useRef } from "react";
import { Terminal, CheckCircle, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { tauriListen } from "@/lib/tauri";
import type { GithubRepo } from "@/lib/github";
import type { RepoMode, NewRepoForm } from "./StepSelectRepo";
import type { SshHost } from "./StepServers";

export type CloneStatus = "idle" | "running" | "done" | "error";

interface StepConfirmProps {
  mode: RepoMode;
  selectedRepo: GithubRepo | null;
  newRepo: NewRepoForm;
  projectName: string;
  clonePath: string;
  selectedServers: string[];
  allHosts: SshHost[];
  status: CloneStatus;
  onStatusChange: (s: CloneStatus) => void;
  logLines: string[];
  onLogLine: (line: string) => void;
}

export function StepConfirm({
  mode,
  selectedRepo,
  newRepo,
  projectName,
  clonePath,
  selectedServers,
  allHosts,
  status,
  onStatusChange,
  logLines,
  onLogLine,
}: StepConfirmProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll terminal to bottom as lines arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logLines]);

  // Subscribe to streaming clone events while running
  useEffect(() => {
    if (status !== "running") return;

    const cleanups: Array<() => void> = [];

    tauriListen<{ line: string }>("zentral://clone-progress", (p) => {
      onLogLine(p.line);
    }).then((fn) => cleanups.push(fn));

    tauriListen<{ path: string }>("zentral://clone-complete", () => {
      onStatusChange("done");
    }).then((fn) => cleanups.push(fn));

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [status, onLogLine, onStatusChange]);

  const repoLabel =
    mode === "link"
      ? (selectedRepo?.full_name ?? "—")
      : `${newRepo.name} (${newRepo.visibility})`;

  const serverLabels = selectedServers.map(
    (alias) =>
      allHosts.find((h) => h.alias === alias)?.hostname
        ? `${alias} (${allHosts.find((h) => h.alias === alias)?.hostname})`
        : alias,
  );

  return (
    <div className="flex flex-col gap-4">
      {status === "idle" && (
        <div className="rounded-md border p-3">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Repository</dt>
            <dd className="truncate font-medium">{repoLabel}</dd>
            <dt className="text-muted-foreground">Project name</dt>
            <dd className="font-medium">{projectName || "—"}</dd>
            <dt className="text-muted-foreground">Clone path</dt>
            <dd className="truncate font-mono text-xs">{clonePath || "—"}</dd>
            <dt className="text-muted-foreground">Servers</dt>
            <dd>
              {serverLabels.length === 0 ? (
                <span className="text-muted-foreground">None</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {serverLabels.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </dd>
          </dl>
        </div>
      )}

      {(status === "running" || status === "done" || status === "error") && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Terminal className="size-4" />
            Clone output
            {status === "done" && (
              <CheckCircle className="size-4 text-green-500" />
            )}
            {status === "error" && (
              <XCircle className="text-destructive size-4" />
            )}
          </div>
          <ScrollArea className="bg-muted h-44 rounded-md border p-3 font-mono text-xs">
            {logLines.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-all leading-5">
                {line}
              </div>
            ))}
            {status === "running" && (
              <div className="mt-1 animate-pulse text-muted-foreground">
                ▌
              </div>
            )}
            <div ref={bottomRef} />
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
