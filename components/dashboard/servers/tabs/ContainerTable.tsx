"use client";

import { useCallback, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";

import { tauriInvoke } from "@/lib/tauri";
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
// Types
// ---------------------------------------------------------------------------

interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: string[];
}

interface ContainerStats {
  name: string;
  cpu_pct: number;
  mem_usage_mb: number;
  mem_pct: number;
  net_rx_mb: number;
  net_tx_mb: number;
  block_read_mb: number;
  block_write_mb: number;
  pids: number;
}

interface ContainerTableProps {
  sessionId: string;
  containers: ContainerInfo[];
  statsMap: Map<string, ContainerStats>;
  filter: string;
}

type SortField = "name" | "image" | "state" | "cpu_pct" | "mem_usage_mb" | "net_io" | "status";
type SortDirection = "asc" | "desc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMb(value: number): string {
  return `${value.toFixed(1)} MB`;
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatNetIo(rx: number, tx: number): string {
  return `${formatMb(rx)} / ${formatMb(tx)}`;
}

function stateBadgeClass(state: string): string {
  const lower = state.toLowerCase();
  if (lower === "running") return "bg-green-600 text-white";
  if (lower === "exited") return "bg-red-600 text-white";
  if (lower === "paused") return "bg-yellow-500 text-white";
  if (lower === "created") return "bg-blue-500 text-white";
  return "bg-muted text-muted-foreground";
}

function getSortValue(
  container: ContainerInfo,
  statsMap: Map<string, ContainerStats>,
  field: SortField,
): string | number {
  const stats = statsMap.get(container.name);

  switch (field) {
    case "name":
      return container.name.toLowerCase();
    case "image":
      return container.image.toLowerCase();
    case "state":
      return container.state.toLowerCase();
    case "status":
      return container.status.toLowerCase();
    case "cpu_pct":
      return stats?.cpu_pct ?? -1;
    case "mem_usage_mb":
      return stats?.mem_usage_mb ?? -1;
    case "net_io":
      return stats ? stats.net_rx_mb + stats.net_tx_mb : -1;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ContainerTable({ sessionId, containers, statsMap, filter }: ContainerTableProps) {
  const [expandedRows, setExpandedRows] = useState<Map<string, string | null>>(new Map());
  const [loadingLogs, setLoadingLogs] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // -----------------------------------------------------------------------
  // Filter
  // -----------------------------------------------------------------------

  const lowerFilter = filter.toLowerCase();
  const filtered = containers.filter(
    (c) =>
      c.name.toLowerCase().includes(lowerFilter) ||
      c.image.toLowerCase().includes(lowerFilter),
  );

  // -----------------------------------------------------------------------
  // Sort
  // -----------------------------------------------------------------------

  const sorted = [...filtered].sort((a, b) => {
    const aVal = getSortValue(a, statsMap, sortField);
    const bVal = getSortValue(b, statsMap, sortField);

    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    }

    const aStr = String(aVal);
    const bStr = String(bVal);
    return sortDirection === "asc"
      ? aStr.localeCompare(bStr)
      : bStr.localeCompare(aStr);
  });

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleSort = useCallback(
    (field: SortField) => {
      if (field === sortField) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
    },
    [sortField],
  );

  const toggleRow = useCallback(
    async (containerName: string) => {
      setExpandedRows((prev) => {
        const next = new Map(prev);
        if (next.has(containerName)) {
          next.delete(containerName);
          return next;
        }
        next.set(containerName, null);
        return next;
      });

      // If logs not yet loaded, fetch them
      if (!expandedRows.has(containerName)) {
        setLoadingLogs((prev) => new Set(prev).add(containerName));
        try {
          const logs = await tauriInvoke<string>("ssh_docker_logs", {
            sessionId,
            containerName,
          });
          setExpandedRows((prev) => {
            const next = new Map(prev);
            if (next.has(containerName)) {
              next.set(containerName, logs);
            }
            return next;
          });
        } catch {
          setExpandedRows((prev) => {
            const next = new Map(prev);
            if (next.has(containerName)) {
              next.set(containerName, "[Failed to fetch logs]");
            }
            return next;
          });
        } finally {
          setLoadingLogs((prev) => {
            const next = new Set(prev);
            next.delete(containerName);
            return next;
          });
        }
      }
    },
    [expandedRows, sessionId],
  );

  // -----------------------------------------------------------------------
  // Sort header helper
  // -----------------------------------------------------------------------

  function SortableHead({ field, children }: { field: SortField; children: React.ReactNode }) {
    const isActive = sortField === field;
    return (
      <TableHead
        className="cursor-pointer select-none"
        onClick={() => handleSort(field)}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          {isActive ? (
            sortDirection === "asc" ? (
              <ArrowUp className="size-3" />
            ) : (
              <ArrowDown className="size-3" />
            )
          ) : (
            <ArrowUpDown className="text-muted-foreground/50 size-3" />
          )}
        </span>
      </TableHead>
    );
  }

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------

  if (sorted.length === 0) {
    return (
      <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
        {filter ? "No containers match your filter" : "No containers found"}
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const colCount = 8;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <SortableHead field="name">Name</SortableHead>
          <SortableHead field="image">Image</SortableHead>
          <SortableHead field="state">State</SortableHead>
          <SortableHead field="cpu_pct">CPU%</SortableHead>
          <SortableHead field="mem_usage_mb">Memory</SortableHead>
          <SortableHead field="net_io">Net I/O</SortableHead>
          <SortableHead field="status">Status</SortableHead>
          <TableHead>Ports</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((container) => {
          const stats = statsMap.get(container.name);
          const isRunning = container.state.toLowerCase() === "running";
          const isExpanded = expandedRows.has(container.name);
          const logs = expandedRows.get(container.name);
          const isLoading = loadingLogs.has(container.name);

          return (
            <ContainerRow
              key={container.id}
              container={container}
              stats={stats}
              isRunning={isRunning}
              isExpanded={isExpanded}
              logs={logs}
              isLoading={isLoading}
              colCount={colCount}
              onToggle={() => toggleRow(container.name)}
            />
          );
        })}
      </TableBody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// ContainerRow (extracted to keep ContainerTable under limit)
// ---------------------------------------------------------------------------

function ContainerRow({
  container,
  stats,
  isRunning,
  isExpanded,
  logs,
  isLoading,
  colCount,
  onToggle,
}: {
  container: ContainerInfo;
  stats: ContainerStats | undefined;
  isRunning: boolean;
  isExpanded: boolean;
  logs: string | null | undefined;
  isLoading: boolean;
  colCount: number;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={onToggle}
      >
        <TableCell className="w-8 px-2">
          {isExpanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </TableCell>
        <TableCell className="font-medium">{container.name}</TableCell>
        <TableCell className="text-muted-foreground max-w-[200px] truncate">
          {container.image}
        </TableCell>
        <TableCell>
          <Badge className={stateBadgeClass(container.state)}>
            {container.state}
          </Badge>
        </TableCell>
        <TableCell className="tabular-nums">
          {isRunning && stats ? formatPct(stats.cpu_pct) : "\u2014"}
        </TableCell>
        <TableCell className="tabular-nums">
          {isRunning && stats
            ? `${formatMb(stats.mem_usage_mb)} (${formatPct(stats.mem_pct)})`
            : "\u2014"}
        </TableCell>
        <TableCell className="tabular-nums">
          {isRunning && stats
            ? formatNetIo(stats.net_rx_mb, stats.net_tx_mb)
            : "\u2014"}
        </TableCell>
        <TableCell className="text-muted-foreground">{container.status}</TableCell>
        <TableCell className="text-muted-foreground max-w-[180px] truncate">
          {container.ports.length > 0 ? container.ports.join(", ") : "\u2014"}
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow>
          <TableCell colSpan={colCount + 1} className="p-0">
            <div className="bg-muted/40 border-t px-4 py-3">
              <p className="text-muted-foreground mb-2 text-xs font-medium">
                Last 50 log lines &mdash; {container.name}
              </p>
              {isLoading ? (
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              ) : (
                <pre className="bg-background max-h-64 overflow-auto rounded-md border p-3 font-mono text-xs leading-relaxed">
                  {logs || "[No logs available]"}
                </pre>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton (used by DockerTab during initial load)
// ---------------------------------------------------------------------------

function ContainerTableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-md" />
      ))}
    </div>
  );
}

export { ContainerTable, ContainerTableSkeleton };
export type { ContainerInfo, ContainerStats, ContainerTableProps };
