"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { tauriInvoke } from "@/lib/tauri";
import { Badge } from "@/components/ui/badge";
import { MetricsSparkline } from "@/components/dashboard/servers/tabs/MetricsSparkline";
import { ProcessTable } from "@/components/dashboard/servers/tabs/ProcessTable";
import type { ProcessInfo } from "@/components/dashboard/servers/tabs/ProcessTable";
import {
  Cpu,
  MemoryStick,
  Gauge,
  HardDrive,
  Network,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------- Types ----------

interface CpuCore {
  id: number;
  usage_pct: number;
}

interface ServerMetrics {
  cpu_total_pct: number;
  cpu_cores: CpuCore[];
  load_avg: [number, number, number];
  mem_total_kb: number;
  mem_used_kb: number;
  mem_cached_kb: number;
  swap_total_kb: number;
  swap_used_kb: number;
  disk_read_bps: number;
  disk_write_bps: number;
  net_rx_bps: number;
  net_tx_bps: number;
  processes: ProcessInfo[];
  uptime_secs: number;
}

interface MetricsTabProps {
  sessionId: string;
  isActive: boolean;
}

// ---------- Helpers ----------

const HISTORY_LENGTH = 30;

function formatBytes(kb: number): string {
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function formatRate(bps: number): string {
  if (bps < 1024) return `${bps.toFixed(0)} B/s`;
  const kbps = bps / 1024;
  if (kbps < 1024) return `${kbps.toFixed(1)} KB/s`;
  const mbps = kbps / 1024;
  return `${mbps.toFixed(2)} MB/s`;
}

function formatUptime(secs: number): string {
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function pushHistory(history: number[], value: number): number[] {
  const next = [...history, value];
  if (next.length > HISTORY_LENGTH) next.shift();
  return next;
}

function cpuColor(pct: number): string {
  if (pct > 90) return "text-red-500";
  if (pct > 70) return "text-yellow-500";
  return "text-emerald-500";
}

function cpuBarColor(pct: number): string {
  if (pct > 90) return "bg-red-500";
  if (pct > 70) return "bg-yellow-500";
  return "bg-emerald-500";
}

// ---------- Sub-Components ----------

function SummaryStrip({ metrics }: { metrics: ServerMetrics }) {
  const memUsedPct = (metrics.mem_used_kb / metrics.mem_total_kb) * 100;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5">
        <Cpu className="text-muted-foreground size-4" />
        <span className="text-xs font-medium">CPU</span>
        <span className={cn("text-sm font-bold tabular-nums", cpuColor(metrics.cpu_total_pct))}>
          {metrics.cpu_total_pct.toFixed(1)}%
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <MemoryStick className="text-muted-foreground size-4" />
        <span className="text-xs font-medium">RAM</span>
        <span className="text-sm font-bold tabular-nums">
          {formatBytes(metrics.mem_used_kb)}
        </span>
        <span className="text-muted-foreground text-xs">/ {formatBytes(metrics.mem_total_kb)}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {memUsedPct.toFixed(0)}%
        </Badge>
      </div>

      <div className="flex items-center gap-1.5">
        <Gauge className="text-muted-foreground size-4" />
        <span className="text-xs font-medium">Load</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {metrics.load_avg[0].toFixed(2)} / {metrics.load_avg[1].toFixed(2)} / {metrics.load_avg[2].toFixed(2)}
        </span>
      </div>

      <div className="text-muted-foreground ml-auto text-xs">
        up {formatUptime(metrics.uptime_secs)}
      </div>
    </div>
  );
}

function MemoryBars({ metrics }: { metrics: ServerMetrics }) {
  const total = metrics.mem_total_kb || 1;
  const usedPct = (metrics.mem_used_kb / total) * 100;
  const cachedPct = (metrics.mem_cached_kb / total) * 100;
  const freePct = 100 - usedPct - cachedPct;

  const swapTotal = metrics.swap_total_kb || 1;
  const swapUsedPct = (metrics.swap_used_kb / swapTotal) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium">Memory</span>
          <span className="text-muted-foreground">
            {formatBytes(metrics.mem_used_kb)} used / {formatBytes(metrics.mem_cached_kb)} cached / {formatBytes(metrics.mem_total_kb - metrics.mem_used_kb - metrics.mem_cached_kb)} free
          </span>
        </div>
        <div className="bg-muted flex h-3 overflow-hidden rounded-full">
          <div
            className="bg-blue-500 transition-all duration-300"
            style={{ width: `${usedPct}%` }}
            title={`Used: ${usedPct.toFixed(1)}%`}
          />
          <div
            className="bg-yellow-500/60 transition-all duration-300"
            style={{ width: `${cachedPct}%` }}
            title={`Cached: ${cachedPct.toFixed(1)}%`}
          />
          <div
            className="flex-1"
            title={`Free: ${freePct.toFixed(1)}%`}
          />
        </div>
        <div className="mt-1 flex gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="bg-blue-500 inline-block size-2 rounded-full" /> Used
          </span>
          <span className="flex items-center gap-1">
            <span className="bg-yellow-500/60 inline-block size-2 rounded-full" /> Cached
          </span>
          <span className="flex items-center gap-1">
            <span className="bg-muted inline-block size-2 rounded-full border" /> Free
          </span>
        </div>
      </div>

      {metrics.swap_total_kb > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium">Swap</span>
            <span className="text-muted-foreground">
              {formatBytes(metrics.swap_used_kb)} / {formatBytes(metrics.swap_total_kb)}
            </span>
          </div>
          <div className="bg-muted flex h-2 overflow-hidden rounded-full">
            <div
              className="bg-orange-500 transition-all duration-300"
              style={{ width: `${swapUsedPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CpuCoreGrid({ cores }: { cores: CpuCore[] }) {
  const [expanded, setExpanded] = useState(false);
  const shouldCollapse = cores.length > 8;
  const visible = shouldCollapse && !expanded ? cores.slice(0, 8) : cores;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium">CPU Cores ({cores.length})</span>
        {shouldCollapse && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-0.5 text-[10px] transition-colors"
          >
            {expanded ? (
              <>
                <ChevronDown className="size-3" /> Collapse
              </>
            ) : (
              <>
                <ChevronRight className="size-3" /> Show all {cores.length}
              </>
            )}
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-x-4 gap-y-1.5">
        {visible.map((core) => (
          <div key={core.id} className="flex items-center gap-2">
            <span className="text-muted-foreground w-6 text-right text-[10px] tabular-nums">
              {core.id}
            </span>
            <div className="bg-muted relative h-1.5 flex-1 overflow-hidden rounded-full">
              <div
                className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-300", cpuBarColor(core.usage_pct))}
                style={{ width: `${Math.min(100, core.usage_pct)}%` }}
              />
            </div>
            <span className="w-9 text-right text-[10px] tabular-nums">
              {core.usage_pct.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IoSparklines({
  diskReadHistory,
  diskWriteHistory,
  netRxHistory,
  netTxHistory,
  currentMetrics,
}: {
  diskReadHistory: number[];
  diskWriteHistory: number[];
  netRxHistory: number[];
  netTxHistory: number[];
  currentMetrics: ServerMetrics;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <HardDrive className="text-muted-foreground size-3.5" />
          <span className="text-xs font-medium">Disk I/O</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-6 text-[10px]">R</span>
            <MetricsSparkline data={diskReadHistory} color="#3b82f6" width={160} height={28} />
            <span className="text-[10px] tabular-nums">{formatRate(currentMetrics.disk_read_bps)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-6 text-[10px]">W</span>
            <MetricsSparkline data={diskWriteHistory} color="#f59e0b" width={160} height={28} />
            <span className="text-[10px] tabular-nums">{formatRate(currentMetrics.disk_write_bps)}</span>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Network className="text-muted-foreground size-3.5" />
          <span className="text-xs font-medium">Network</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-6 text-[10px]">RX</span>
            <MetricsSparkline data={netRxHistory} color="#10b981" width={160} height={28} />
            <span className="text-[10px] tabular-nums">{formatRate(currentMetrics.net_rx_bps)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-6 text-[10px]">TX</span>
            <MetricsSparkline data={netTxHistory} color="#8b5cf6" width={160} height={28} />
            <span className="text-[10px] tabular-nums">{formatRate(currentMetrics.net_tx_bps)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Main Component ----------

function MetricsTab({ sessionId, isActive }: MetricsTabProps) {
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Rolling histories for sparklines
  const [diskReadHistory, setDiskReadHistory] = useState<number[]>([]);
  const [diskWriteHistory, setDiskWriteHistory] = useState<number[]>([]);
  const [netRxHistory, setNetRxHistory] = useState<number[]>([]);
  const [netTxHistory, setNetTxHistory] = useState<number[]>([]);

  const mountedRef = useRef(true);

  const fetchMetrics = useCallback(async () => {
    try {
      const result = await tauriInvoke<ServerMetrics>("ssh_get_metrics", {
        sessionId,
      });
      if (!mountedRef.current) return;

      setMetrics(result);
      setError(null);

      setDiskReadHistory((h) => pushHistory(h, result.disk_read_bps));
      setDiskWriteHistory((h) => pushHistory(h, result.disk_write_bps));
      setNetRxHistory((h) => pushHistory(h, result.net_rx_bps));
      setNetTxHistory((h) => pushHistory(h, result.net_tx_bps));
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [sessionId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchMetrics();

    const interval = setInterval(fetchMetrics, isActive ? 2000 : 5000);
    return () => clearInterval(interval);
  }, [fetchMetrics, isActive]);

  if (error && !metrics) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-destructive text-sm font-medium">Failed to fetch metrics</p>
          <p className="text-muted-foreground mt-1 text-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading metrics...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      {/* 1. Summary strip */}
      <SummaryStrip metrics={metrics} />

      {/* 2. Process table */}
      <ProcessTable processes={metrics.processes} />

      {/* 3. Memory bars */}
      <MemoryBars metrics={metrics} />

      {/* 4. Per-core CPU grid */}
      <CpuCoreGrid cores={metrics.cpu_cores} />

      {/* 5. I/O sparklines */}
      <IoSparklines
        diskReadHistory={diskReadHistory}
        diskWriteHistory={diskWriteHistory}
        netRxHistory={netRxHistory}
        netTxHistory={netTxHistory}
        currentMetrics={metrics}
      />
    </div>
  );
}

export { MetricsTab };
export type { MetricsTabProps, ServerMetrics };
