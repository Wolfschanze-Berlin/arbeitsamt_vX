"use client";

import { useState, useEffect } from "react";
import { Server } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { tauriInvoke } from "@/lib/tauri";

export interface SshHost {
  alias: string;
  hostname: string;
}

interface StepServersProps {
  selected: string[];
  onSelectionChange: (aliases: string[]) => void;
  onHostsLoaded?: (hosts: SshHost[]) => void;
}

export function StepServers({ selected, onSelectionChange, onHostsLoaded }: StepServersProps) {
  const [hosts, setHosts] = useState<SshHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHosts() {
      try {
        const aliases = await tauriInvoke<string[]>("ssh_list_config_hosts");
        const filtered = aliases.filter((a) => a !== "*");
        const resolved = await Promise.all(
          filtered.map(async (alias) => {
            try {
              const cfg = await tauriInvoke<{ hostname: string }>(
                "ssh_resolve_config",
                { host: alias },
              );
              return { alias, hostname: cfg.hostname };
            } catch {
              return { alias, hostname: alias };
            }
          }),
        );
        setHosts(resolved);
        onHostsLoaded?.(resolved);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load hosts");
      } finally {
        setLoading(false);
      }
    }
    loadHosts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(alias: string) {
    onSelectionChange(
      selected.includes(alias)
        ? selected.filter((a) => a !== alias)
        : [...selected, alias],
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        Select SSH config aliases to associate with this project. You can skip
        this step and add servers later.
      </p>

      {loading && (
        <p className="text-muted-foreground text-sm">Loading SSH hosts…</p>
      )}
      {error && (
        <p className="text-destructive text-sm">Failed to load hosts: {error}</p>
      )}

      {!loading && !error && hosts.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No SSH config aliases found.
        </p>
      )}

      {!loading && hosts.length > 0 && (
        <ScrollArea className="h-52 rounded-md border">
          <div className="flex flex-col gap-0.5 p-1">
            {hosts.map((h) => (
              <label
                key={h.alias}
                className="flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 transition-colors hover:bg-accent"
              >
                <Checkbox
                  checked={selected.includes(h.alias)}
                  onCheckedChange={() => toggle(h.alias)}
                />
                <div className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Server className="size-3.5 shrink-0" />
                    {h.alias}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {h.hostname}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
