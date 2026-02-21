"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Container,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Terminal,
} from "lucide-react";

import { tauriInvoke } from "@/lib/tauri";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ContainerTable,
  ContainerTableSkeleton,
} from "@/components/dashboard/servers/tabs/ContainerTable";
import type { ContainerInfo, ContainerStats } from "@/components/dashboard/servers/tabs/ContainerTable";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DockerTabProps {
  sessionId: string;
}

interface DockerInfo {
  version: string;
  containers_running: number;
  containers_stopped: number;
  containers_paused: number;
  images: number;
}

interface DockerData {
  info: DockerInfo;
  containers: ContainerInfo[];
  stats: ContainerStats[];
}

type DockerError =
  | { kind: "not-installed" }
  | { kind: "not-running" }
  | { kind: "permission-denied" }
  | { kind: "unknown"; message: string };

type LoadState =
  | { status: "loading" }
  | { status: "loaded"; data: DockerData; statsMap: Map<string, ContainerStats> }
  | { status: "error"; error: DockerError };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REFRESH_INTERVAL_MS = 10_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classifyError(err: unknown): DockerError {
  const message = extractMessage(err);
  const lower = message.toLowerCase();

  if (lower.includes("not installed")) return { kind: "not-installed" };
  if (lower.includes("not running") || lower.includes("daemon")) return { kind: "not-running" };
  if (lower.includes("permission denied")) return { kind: "permission-denied" };
  return { kind: "unknown", message };
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  if (typeof err === "string") return err;
  return "An unknown error occurred";
}

function buildStatsMap(stats: ContainerStats[]): Map<string, ContainerStats> {
  const map = new Map<string, ContainerStats>();
  for (const s of stats) {
    map.set(s.name, s);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function DockerTab({ sessionId }: DockerTabProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [filter, setFilter] = useState("");
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastRefreshRef = useRef<number>(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -----------------------------------------------------------------------
  // Fetch docker data
  // -----------------------------------------------------------------------

  const fetchData = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) setIsRefreshing(true);

      try {
        const data = await tauriInvoke<DockerData>("ssh_docker_data", { sessionId });
        const statsMap = buildStatsMap(data.stats);
        setState({ status: "loaded", data, statsMap });
        lastRefreshRef.current = Date.now();
        setSecondsAgo(0);
      } catch (err) {
        setState({ status: "error", error: classifyError(err) });
      } finally {
        if (showSpinner) setIsRefreshing(false);
      }
    },
    [sessionId],
  );

  // -----------------------------------------------------------------------
  // Auto-refresh interval + countdown tick
  // -----------------------------------------------------------------------

  useEffect(() => {
    // Initial fetch
    fetchData(false);

    // Auto-refresh every 10s
    intervalRef.current = setInterval(() => {
      fetchData(false);
    }, REFRESH_INTERVAL_MS);

    // Update "Xs ago" every second
    tickRef.current = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastRefreshRef.current) / 1000));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [fetchData]);

  // -----------------------------------------------------------------------
  // Manual refresh (resets countdown + auto-refresh timer)
  // -----------------------------------------------------------------------

  const handleRefresh = useCallback(() => {
    // Reset auto-refresh timer
    if (intervalRef.current) clearInterval(intervalRef.current);
    fetchData(true);
    intervalRef.current = setInterval(() => {
      fetchData(false);
    }, REFRESH_INTERVAL_MS);
  }, [fetchData]);

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Loader2 className="text-muted-foreground size-4 animate-spin" />
          <span className="text-muted-foreground text-sm">Loading Docker data...</span>
        </div>
        <ContainerTableSkeleton />
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------

  if (state.status === "error") {
    return <DockerErrorAlert error={state.error} onRetry={() => fetchData(true)} />;
  }

  // -----------------------------------------------------------------------
  // Loaded state
  // -----------------------------------------------------------------------

  const { data, statsMap } = state;
  const { info } = data;

  return (
    <div className="flex flex-col gap-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Container className="text-muted-foreground size-4" />
          <span className="text-sm font-medium">Docker v{info.version}</span>
          <span className="text-muted-foreground text-sm">|</span>
          <Badge variant="secondary" className="gap-1 text-xs">
            <span className="size-1.5 rounded-full bg-green-500" />
            {info.containers_running} running
          </Badge>
          <Badge variant="secondary" className="gap-1 text-xs">
            <span className="size-1.5 rounded-full bg-red-500" />
            {info.containers_stopped} stopped
          </Badge>
          {info.containers_paused > 0 && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <span className="size-1.5 rounded-full bg-yellow-500" />
              {info.containers_paused} paused
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            {info.images} images
          </Badge>
        </div>

        <span className="text-muted-foreground text-xs tabular-nums">
          Last refreshed {secondsAgo}s ago
        </span>
      </div>

      {/* Search + Refresh */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
          <Input
            placeholder="Filter containers..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-1.5"
        >
          <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Container table */}
      <ContainerTable
        sessionId={sessionId}
        containers={data.containers}
        statsMap={statsMap}
        filter={filter}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error alert sub-component
// ---------------------------------------------------------------------------

function DockerErrorAlert({
  error,
  onRetry,
}: {
  error: DockerError;
  onRetry: () => void;
}) {
  let icon = <AlertCircle className="size-4" />;
  let title = "Docker Error";
  let description = "";

  switch (error.kind) {
    case "not-installed":
      icon = <Terminal className="size-4" />;
      title = "Docker Not Installed";
      description = "Docker is not installed on this server.";
      break;
    case "not-running":
      icon = <Container className="size-4" />;
      title = "Docker Daemon Not Running";
      description = "Docker daemon is not running. Try: sudo systemctl start docker";
      break;
    case "permission-denied":
      icon = <ShieldAlert className="size-4" />;
      title = "Permission Denied";
      description =
        "Permission denied. Try: sudo usermod -aG docker $USER && newgrp docker";
      break;
    case "unknown":
      description = error.message;
      break;
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <Alert variant="destructive" className="max-w-lg">
        {icon}
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          <p>{description}</p>
        </AlertDescription>
      </Alert>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
        <RefreshCw className="size-3.5" />
        Retry
      </Button>
    </div>
  );
}

export { DockerTab };
export type { DockerTabProps };
