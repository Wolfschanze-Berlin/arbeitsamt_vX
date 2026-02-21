"use client";

import { useEffect, useState, useCallback } from "react";
import { ServerCard } from "@/components/dashboard/servers/ServerCard";
import { tauriInvoke } from "@/lib/tauri";
import { Loader2, ServerOff } from "lucide-react";

type ServerStatus = "checking" | "reachable" | "unreachable";

interface ResolvedHost {
  alias: string;
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

export default function ServersPage() {
  const [hosts, setHosts] = useState<ResolvedHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHosts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const aliases = await tauriInvoke<string[]>("ssh_list_config_hosts");
      const filtered = aliases.filter((a) => a !== "*");

      if (filtered.length === 0) {
        setHosts([]);
        setLoading(false);
        return;
      }

      // Resolve config for each host
      const resolved = await Promise.all(
        filtered.map(async (alias) => {
          try {
            const config = await tauriInvoke<SshResolveResult>(
              "ssh_resolve_config",
              { host: alias },
            );
            return {
              alias,
              hostname: config.hostname,
              port: config.port,
              username: config.username,
              status: "checking" as ServerStatus,
            };
          } catch {
            return {
              alias,
              hostname: alias,
              port: 22,
              username: "unknown",
              status: "unreachable" as ServerStatus,
            };
          }
        }),
      );

      setHosts(resolved);
      setLoading(false);

      // Ping all hosts in parallel and update status individually
      await Promise.all(
        resolved.map(async (host) => {
          if (host.status === "unreachable") return;
          try {
            const reachable = await tauriInvoke<boolean>("ssh_ping_host", {
              host: host.hostname,
              port: host.port,
            });
            setHosts((prev) =>
              prev.map((h) =>
                h.alias === host.alias
                  ? { ...h, status: reachable ? "reachable" : "unreachable" }
                  : h,
              ),
            );
          } catch {
            setHosts((prev) =>
              prev.map((h) =>
                h.alias === host.alias ? { ...h, status: "unreachable" } : h,
              ),
            );
          }
        }),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load SSH hosts",
      );
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHosts();
  }, [loadHosts]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="text-muted-foreground size-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8">
        <ServerOff className="text-muted-foreground size-10" />
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    );
  }

  if (hosts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8">
        <ServerOff className="text-muted-foreground size-10" />
        <p className="text-muted-foreground text-sm">
          No SSH hosts configured. Add hosts to ~/.ssh/config to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Servers</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {hosts.map((host) => (
          <ServerCard
            key={host.alias}
            alias={host.alias}
            hostname={host.hostname}
            port={host.port}
            username={host.username}
            status={host.status}
          />
        ))}
      </div>
    </div>
  );
}
