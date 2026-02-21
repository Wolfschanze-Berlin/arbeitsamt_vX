"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Server,
  Plus,
  Trash2,
  Terminal,
  Loader2,
  ServerOff,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { tauriInvoke } from "@/lib/tauri";
import { useZentral } from "@/context/ZentralContext";
import type { ZentralProjectEntry, ZentralServer } from "@/lib/zentral/types";

// --- Types ---

type ServerStatus = "checking" | "reachable" | "unreachable";

interface ResolvedServer extends ZentralServer {
  hostname: string;
  port: number;
  username: string;
  status: ServerStatus;
}

interface SshResolveResult {
  hostname: string;
  port: number;
  username: string;
  identity_file: string | null;
}

// --- Status dot ---

const statusDot: Record<ServerStatus, string> = {
  checking: "bg-muted-foreground/50 animate-pulse",
  reachable: "bg-green-500",
  unreachable: "bg-red-500",
};

const statusLabel: Record<ServerStatus, string> = {
  checking: "Checking",
  reachable: "Reachable",
  unreachable: "Unreachable",
};

// --- Copy button ---

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
      aria-label="Copy clone command"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

// --- Props ---

interface ServersTabProps {
  project: ZentralProjectEntry;
}

// --- Component ---

export function ServersTab({ project }: ServersTabProps) {
  const router = useRouter();
  const { addOrUpdateProject } = useZentral();

  const associated = project.config?.servers ?? [];

  const [servers, setServers] = useState<ResolvedServer[]>([]);
  const [loadingServers, setLoadingServers] = useState(true);
  const [availableAliases, setAvailableAliases] = useState<string[]>([]);
  const [loadingAliases, setLoadingAliases] = useState(false);

  // Resolve config + ping for each associated server
  const loadServers = useCallback(async () => {
    if (associated.length === 0) {
      setServers([]);
      setLoadingServers(false);
      return;
    }

    setLoadingServers(true);

    const resolved = await Promise.all(
      associated.map(async (s) => {
        try {
          const cfg = await tauriInvoke<SshResolveResult>("ssh_resolve_config", {
            host: s.sshAlias,
          });
          return { ...s, hostname: cfg.hostname, port: cfg.port, username: cfg.username, status: "checking" as ServerStatus };
        } catch {
          return { ...s, hostname: s.sshAlias, port: 22, username: "unknown", status: "unreachable" as ServerStatus };
        }
      }),
    );

    setServers(resolved);
    setLoadingServers(false);

    // Ping each in parallel; update status individually
    await Promise.all(
      resolved.map(async (srv) => {
        if (srv.status === "unreachable") return;
        try {
          const reachable = await tauriInvoke<boolean>("ssh_ping_host", {
            host: srv.hostname,
            port: srv.port,
          });
          setServers((prev) =>
            prev.map((s) =>
              s.sshAlias === srv.sshAlias
                ? { ...s, status: reachable ? "reachable" : "unreachable" }
                : s,
            ),
          );
        } catch {
          setServers((prev) =>
            prev.map((s) =>
              s.sshAlias === srv.sshAlias ? { ...s, status: "unreachable" } : s,
            ),
          );
        }
      }),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  // Load available (not yet associated) SSH aliases when dropdown opens
  async function handleOpenAddMenu() {
    setLoadingAliases(true);
    try {
      const all = await tauriInvoke<string[]>("ssh_list_config_hosts");
      const used = new Set(associated.map((s) => s.sshAlias));
      setAvailableAliases(all.filter((a) => a !== "*" && !used.has(a)));
    } catch {
      setAvailableAliases([]);
    } finally {
      setLoadingAliases(false);
    }
  }

  async function handleAddServer(alias: string) {
    const updatedServers = [...associated, { sshAlias: alias } satisfies ZentralServer];
    await addOrUpdateProject({
      ...project,
      config: project.config
        ? { ...project.config, servers: updatedServers }
        : { version: "1", name: project.name, servers: updatedServers, cloud: [] },
    });
  }

  async function handleRemoveServer(alias: string) {
    const updatedServers = associated.filter((s) => s.sshAlias !== alias);
    await addOrUpdateProject({
      ...project,
      config: project.config
        ? { ...project.config, servers: updatedServers }
        : { version: "1", name: project.name, servers: [], cloud: [] },
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          SSH servers associated with this project.
        </p>
        <DropdownMenu onOpenChange={(open) => open && handleOpenAddMenu()}>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="mr-1.5 size-3.5" />
              Add Server
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {loadingAliases && (
              <div className="text-muted-foreground flex items-center gap-2 px-2 py-1.5 text-sm">
                <Loader2 className="size-3.5 animate-spin" />
                Loading…
              </div>
            )}
            {!loadingAliases && availableAliases.length === 0 && (
              <div className="text-muted-foreground px-2 py-1.5 text-sm">
                No available aliases.
              </div>
            )}
            {availableAliases.map((alias) => (
              <DropdownMenuItem key={alias} onSelect={() => handleAddServer(alias)}>
                <Server className="mr-2 size-3.5" />
                {alias}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Loading */}
      {loadingServers && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loadingServers && servers.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-10">
          <ServerOff className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">
            No servers associated. Add servers from your SSH config.
          </p>
        </div>
      )}

      {/* Server cards */}
      {!loadingServers && servers.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {servers.map((srv) => {
            const cloneCmd = `git clone ${project.remoteUrl ?? "."} ${srv.cloneDir ?? "."}`;
            return (
              <Card key={srv.sshAlias}>
                <CardHeader className="flex-row items-center justify-between pb-2">
                  <CardTitle className="flex items-center gap-1.5 truncate text-sm">
                    <Server className="size-3.5 shrink-0" />
                    {srv.label ?? srv.sshAlias}
                  </CardTitle>
                  <span
                    className={cn("size-2.5 shrink-0 rounded-full", statusDot[srv.status])}
                    aria-label={statusLabel[srv.status]}
                  />
                </CardHeader>
                <CardContent className="flex flex-col gap-2 pt-0">
                  <div className="space-y-0.5">
                    <p className="text-muted-foreground truncate text-xs">
                      {srv.hostname}:{srv.port}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">{srv.username}</p>
                  </div>

                  {/* Clone command */}
                  {project.remoteUrl && (
                    <div className="bg-muted flex items-center gap-1.5 rounded px-2 py-1">
                      <code className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                        {cloneCmd}
                      </code>
                      <CopyButton text={cloneCmd} />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={() =>
                        router.push(`/ssh?host=${encodeURIComponent(srv.sshAlias)}`)
                      }
                    >
                      <Terminal className="mr-1 size-3" />
                      Connect
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive px-2"
                      onClick={() => handleRemoveServer(srv.sshAlias)}
                      aria-label={`Remove ${srv.sshAlias}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
