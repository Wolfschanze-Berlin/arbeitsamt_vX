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

interface WslEntry {
  distro: string;
  parentAlias: string;
  parentHostname: string;
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
  const [wslEntries, setWslEntries] = useState<WslEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWslEntries([]);

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
      const pingResults = await Promise.all(
        resolved.map(async (host) => {
          if (host.status === "unreachable") return { alias: host.alias, reachable: false };
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
            return { alias: host.alias, reachable };
          } catch {
            setHosts((prev) =>
              prev.map((h) =>
                h.alias === host.alias ? { ...h, status: "unreachable" } : h,
              ),
            );
            return { alias: host.alias, reachable: false };
          }
        }),
      );

      // Detect WSL distros from two sources in parallel:
      // 1. Local machine (runs `wsl -l -q` directly)
      // 2. Reachable remote hosts (lightweight SSH probe)
      const reachableHosts = resolved.filter((h) =>
        pingResults.some((p) => p.alias === h.alias && p.reachable),
      );

      const [localDistros, ...remoteResults] = await Promise.all([
        // Local WSL detection
        tauriInvoke<string[]>("local_list_wsl_distros").catch(() => [] as string[]),
        // Remote WSL detection for each reachable host
        ...reachableHosts.map(async (host) => {
          try {
            const distros = await tauriInvoke<string[]>(
              "ssh_probe_wsl",
              { host: host.alias },
            );
            return distros.map((distro) => ({
              distro,
              parentAlias: host.alias,
              parentHostname: host.hostname,
              port: host.port,
              username: host.username,
              status: "reachable" as ServerStatus,
            }));
          } catch {
            return [] as WslEntry[];
          }
        }),
      ]);

      // Combine local + remote WSL entries
      const localEntries: WslEntry[] = (localDistros as string[]).map((distro) => ({
        distro,
        parentAlias: "localhost",
        parentHostname: "localhost",
        port: 0,
        username: "",
        status: "reachable" as ServerStatus,
      }));

      setWslEntries([...localEntries, ...(remoteResults as WslEntry[][]).flat()]);
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

  if (hosts.length === 0 && wslEntries.length === 0) {
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
        {wslEntries.map((wsl) => (
          <ServerCard
            key={`wsl-${wsl.parentAlias}-${wsl.distro}`}
            alias={wsl.distro}
            hostname={wsl.parentHostname}
            port={wsl.port}
            username={wsl.username}
            status={wsl.status}
            wslDistro={wsl.distro}
            parentHost={wsl.parentAlias}
          />
        ))}
      </div>
    </div>
  );
}
