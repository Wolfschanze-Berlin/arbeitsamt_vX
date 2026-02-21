"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { tauriInvoke } from "@/lib/tauri";
import { BtopBarChart } from "@/components/dashboard/servers/tabs/MetricsSparkline";
import { ProcessTable } from "@/components/dashboard/servers/tabs/ProcessTable";
import type { ProcessInfo } from "@/components/dashboard/servers/tabs/ProcessTable";
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

const HISTORY_LENGTH = 60;

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

function usageColor(pct: number): string {
  if (pct > 90) return "text-red-400";
  if (pct > 70) return "text-yellow-400";
  if (pct > 40) return "text-green-400";
  return "text-cyan-400";
}

function barGradientColor(pct: number): string {
  if (pct > 90) return "#ef4444";
  if (pct > 70) return "#eab308";
  if (pct > 40) return "#22c55e";
  return "#06b6d4";
}

// ---------- Panel Wrapper ----------

function Panel({
  title,
  titleRight,
  children,
  className,
}: {
  title: string;
  titleRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col overflow-hidden rounded border border-slate-700/60 bg-slate-950/80", className)}>
      <div className="flex items-center justify-between border-b border-slate-700/40 px-2.5 py-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {title}
        </span>
        {titleRight && (
          <span className="text-[10px] tabular-nums text-slate-400">
            {titleRight}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

// ---------- CPU Panel ----------

function CpuPanel({
  cores,
  totalPct,
  cpuHistory,
  loadAvg,
}: {
  cores: CpuCore[];
  totalPct: number;
  cpuHistory: number[];
  loadAvg: [number, number, number];
}) {
  return (
    <Panel
      title="cpu"
      titleRight={
        <span className={usageColor(totalPct)}>
          {totalPct.toFixed(1)}%{" "}
          <span className="text-slate-600">
            load {loadAvg[0].toFixed(2)} {loadAvg[1].toFixed(2)} {loadAvg[2].toFixed(2)}
          </span>
        </span>
      }
    >
      <div className="flex h-full flex-col gap-1 p-2">
        {/* History graph */}
        <div className="h-16 w-full">
          <BtopBarChart
            data={cpuHistory}
            color={barGradientColor(totalPct)}
            width={400}
            height={64}
            maxValue={100}
          />
        </div>

        {/* Per-core bars */}
        <div className="grid auto-rows-[14px] grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[10px]">
          {cores.map((core) => (
            <div key={core.id} className="flex items-center gap-1.5">
              <span className="w-4 text-right text-slate-600">{core.id}</span>
              <div className="relative h-[6px] flex-1 overflow-hidden rounded-[1px] bg-slate-800">
                <div
                  className="absolute inset-y-0 left-0 rounded-[1px] transition-all duration-300"
                  style={{
                    width: `${Math.min(100, core.usage_pct)}%`,
                    backgroundColor: barGradientColor(core.usage_pct),
                  }}
                />
              </div>
              <span className={cn("w-8 text-right tabular-nums", usageColor(core.usage_pct))}>
                {core.usage_pct.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// ---------- Memory Panel ----------

function MemPanel({
  metrics,
  memHistory,
}: {
  metrics: ServerMetrics;
  memHistory: number[];
}) {
  const total = metrics.mem_total_kb || 1;
  const usedPct = (metrics.mem_used_kb / total) * 100;
  const cachedPct = (metrics.mem_cached_kb / total) * 100;
  const swapTotal = metrics.swap_total_kb || 1;
  const swapPct = (metrics.swap_used_kb / swapTotal) * 100;

  return (
    <Panel
      title="mem"
      titleRight={
        <span className={usageColor(usedPct)}>
          {formatBytes(metrics.mem_used_kb)}
          <span className="text-slate-600"> / {formatBytes(metrics.mem_total_kb)}</span>
        </span>
      }
    >
      <div className="flex h-full flex-col gap-2 p-2">
        {/* History graph */}
        <div className="h-16 w-full">
          <BtopBarChart
            data={memHistory}
            color={barGradientColor(usedPct)}
            width={400}
            height={64}
            maxValue={100}
          />
        </div>

        {/* RAM bar */}
        <div className="font-mono text-[10px]">
          <div className="mb-0.5 flex items-center justify-between">
            <span className="text-slate-500">RAM</span>
            <span className="text-slate-400">{usedPct.toFixed(1)}%</span>
          </div>
          <div className="relative h-[8px] overflow-hidden rounded-[2px] bg-slate-800">
            <div
              className="absolute inset-y-0 left-0 transition-all duration-300"
              style={{ width: `${usedPct}%`, backgroundColor: barGradientColor(usedPct) }}
            />
            <div
              className="absolute inset-y-0 transition-all duration-300"
              style={{
                left: `${usedPct}%`,
                width: `${cachedPct}%`,
                backgroundColor: "#eab308",
                opacity: 0.3,
              }}
            />
          </div>
          <div className="mt-0.5 flex gap-3 text-[9px] text-slate-600">
            <span>used {formatBytes(metrics.mem_used_kb)}</span>
            <span>cached {formatBytes(metrics.mem_cached_kb)}</span>
            <span>free {formatBytes(total - metrics.mem_used_kb - metrics.mem_cached_kb)}</span>
          </div>
        </div>

        {/* Swap bar */}
        {metrics.swap_total_kb > 0 && (
          <div className="font-mono text-[10px]">
            <div className="mb-0.5 flex items-center justify-between">
              <span className="text-slate-500">SWP</span>
              <span className="text-slate-400">{swapPct.toFixed(1)}%</span>
            </div>
            <div className="relative h-[6px] overflow-hidden rounded-[1px] bg-slate-800">
              <div
                className="absolute inset-y-0 left-0 transition-all duration-300"
                style={{ width: `${swapPct}%`, backgroundColor: "#f97316" }}
              />
            </div>
            <div className="mt-0.5 text-[9px] text-slate-600">
              {formatBytes(metrics.swap_used_kb)} / {formatBytes(metrics.swap_total_kb)}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ---------- Network Panel ----------

function NetPanel({
  metrics,
  rxHistory,
  txHistory,
}: {
  metrics: ServerMetrics;
  rxHistory: number[];
  txHistory: number[];
}) {
  return (
    <Panel
      title="net"
      titleRight={
        <>
          <span className="text-green-400">▼ {formatRate(metrics.net_rx_bps)}</span>
          {" "}
          <span className="text-purple-400">▲ {formatRate(metrics.net_tx_bps)}</span>
        </>
      }
    >
      <div className="flex h-full flex-col gap-1.5 p-2">
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="w-5 text-green-500">RX</span>
          <div className="h-7 flex-1">
            <BtopBarChart data={rxHistory} color="#22c55e" width={200} height={28} />
          </div>
          <span className="w-16 text-right tabular-nums text-green-400">
            {formatRate(metrics.net_rx_bps)}
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="w-5 text-purple-500">TX</span>
          <div className="h-7 flex-1">
            <BtopBarChart data={txHistory} color="#a855f7" width={200} height={28} />
          </div>
          <span className="w-16 text-right tabular-nums text-purple-400">
            {formatRate(metrics.net_tx_bps)}
          </span>
        </div>
      </div>
    </Panel>
  );
}

// ---------- Disk I/O Panel ----------

function DiskPanel({
  metrics,
  readHistory,
  writeHistory,
}: {
  metrics: ServerMetrics;
  readHistory: number[];
  writeHistory: number[];
}) {
  return (
    <Panel
      title="disk"
      titleRight={
        <>
          <span className="text-blue-400">R {formatRate(metrics.disk_read_bps)}</span>
          {" "}
          <span className="text-amber-400">W {formatRate(metrics.disk_write_bps)}</span>
        </>
      }
    >
      <div className="flex h-full flex-col gap-1.5 p-2">
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="w-5 text-blue-500">R</span>
          <div className="h-7 flex-1">
            <BtopBarChart data={readHistory} color="#3b82f6" width={200} height={28} />
          </div>
          <span className="w-16 text-right tabular-nums text-blue-400">
            {formatRate(metrics.disk_read_bps)}
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="w-5 text-amber-500">W</span>
          <div className="h-7 flex-1">
            <BtopBarChart data={writeHistory} color="#f59e0b" width={200} height={28} />
          </div>
          <span className="w-16 text-right tabular-nums text-amber-400">
            {formatRate(metrics.disk_write_bps)}
          </span>
        </div>
      </div>
    </Panel>
  );
}

// ---------- Main Component ----------

function MetricsTab({ sessionId, isActive }: MetricsTabProps) {
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Rolling histories
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);
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

      setCpuHistory((h) => pushHistory(h, result.cpu_total_pct));
      const memPct = (result.mem_used_kb / (result.mem_total_kb || 1)) * 100;
      setMemHistory((h) => pushHistory(h, memPct));
      setDiskReadHistory((h) => pushHistory(h, result.disk_read_bps));
      setDiskWriteHistory((h) => pushHistory(h, result.disk_write_bps));
      setNetRxHistory((h) => pushHistory(h, result.net_rx_bps));
      setNetTxHistory((h) => pushHistory(h, result.net_tx_bps));
    } catch (err) {
      if (!mountedRef.current) return;
      const e = err as Record<string, unknown>;
      setError(typeof e?.message === "string" ? e.message : JSON.stringify(err));
    }
  }, [sessionId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, isActive ? 2000 : 5000);
    return () => clearInterval(interval);
  }, [fetchMetrics, isActive]);

  if (error && !metrics) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950">
        <div className="text-center font-mono">
          <p className="text-sm text-red-400">Failed to fetch metrics</p>
          <p className="mt-1 text-xs text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950">
        <div className="font-mono text-sm text-slate-500">
          <span className="animate-pulse">Loading metrics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-1.5 overflow-y-auto bg-slate-950 p-1.5 font-mono">
      {/* Status bar */}
      <div className="flex items-center justify-between rounded border border-slate-800/50 bg-slate-900/50 px-3 py-1 text-[10px]">
        <div className="flex items-center gap-4">
          <span className="text-slate-500">
            cpu{" "}
            <span className={usageColor(metrics.cpu_total_pct)}>
              {metrics.cpu_total_pct.toFixed(1)}%
            </span>
          </span>
          <span className="text-slate-500">
            mem{" "}
            <span className={usageColor((metrics.mem_used_kb / (metrics.mem_total_kb || 1)) * 100)}>
              {formatBytes(metrics.mem_used_kb)}
            </span>
            <span className="text-slate-700"> / {formatBytes(metrics.mem_total_kb)}</span>
          </span>
          <span className="text-slate-500">
            load{" "}
            <span className="text-slate-400 tabular-nums">
              {metrics.load_avg[0].toFixed(2)}
            </span>
          </span>
          <span className="text-slate-500">
            procs{" "}
            <span className="text-slate-400 tabular-nums">{metrics.processes.length}</span>
          </span>
        </div>
        <span className="text-slate-600">
          up {formatUptime(metrics.uptime_secs)}
        </span>
      </div>

      {/* Top row: CPU + Memory */}
      <div className="grid min-h-0 flex-shrink-0 grid-cols-2 gap-1.5">
        <CpuPanel
          cores={metrics.cpu_cores}
          totalPct={metrics.cpu_total_pct}
          cpuHistory={cpuHistory}
          loadAvg={metrics.load_avg}
        />
        <MemPanel metrics={metrics} memHistory={memHistory} />
      </div>

      {/* Middle row: Net + Disk */}
      <div className="grid min-h-0 flex-shrink-0 grid-cols-2 gap-1.5">
        <NetPanel
          metrics={metrics}
          rxHistory={netRxHistory}
          txHistory={netTxHistory}
        />
        <DiskPanel
          metrics={metrics}
          readHistory={diskReadHistory}
          writeHistory={diskWriteHistory}
        />
      </div>

      {/* Bottom: Process table */}
      <Panel title="processes" titleRight={`${metrics.processes.length} total`} className="min-h-[200px] flex-1">
        <ProcessTable processes={metrics.processes} />
      </Panel>
    </div>
  );
}

export { MetricsTab };
export type { MetricsTabProps, ServerMetrics };
