"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Cpu, HardDrive, Monitor, Network, RefreshCw, Timer } from "lucide-react";
import { tauriInvoke } from "@/lib/tauri";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface OverviewTabProps {
  sessionId: string;
}

interface SystemInfo {
  os: string;
  cpu: string;
  ram: { total: number; used: number; free: number };
  disks: DiskEntry[];
  uptime: string;
  ips: string[];
}

interface DiskEntry {
  filesystem: string;
  size: string;
  used: string;
  avail: string;
  usePercent: string;
  mountedOn: string;
}

const COMMAND = [
  "uname -a",
  "echo '---DELIM---'",
  "cat /proc/cpuinfo | grep 'model name' | head -1",
  "echo '---DELIM---'",
  "free -m",
  "echo '---DELIM---'",
  "df -h",
  "echo '---DELIM---'",
  "uptime",
  "echo '---DELIM---'",
  "hostname -I",
].join(" && ");

function parseRam(section: string): SystemInfo["ram"] {
  const lines = section.trim().split("\n");
  const memLine = lines.find((l) => l.startsWith("Mem:"));
  if (!memLine) return { total: 0, used: 0, free: 0 };

  const parts = memLine.split(/\s+/);
  return {
    total: Math.round((parseInt(parts[1], 10) / 1024) * 10) / 10,
    used: Math.round((parseInt(parts[2], 10) / 1024) * 10) / 10,
    free: Math.round((parseInt(parts[3], 10) / 1024) * 10) / 10,
  };
}

function parseDisks(section: string): DiskEntry[] {
  const lines = section.trim().split("\n");
  const skipFs = new Set(["tmpfs", "devtmpfs", "overlay", "shm", "none"]);

  return lines
    .slice(1)
    .map((line) => {
      const parts = line.split(/\s+/);
      if (parts.length < 6) return null;
      const fs = parts[0];
      if (skipFs.has(fs)) return null;
      return {
        filesystem: fs,
        size: parts[1],
        used: parts[2],
        avail: parts[3],
        usePercent: parts[4],
        mountedOn: parts.slice(5).join(" "),
      };
    })
    .filter((d): d is DiskEntry => d !== null);
}

function parseUptime(section: string): string {
  const raw = section.trim();

  // Match "up X days, HH:MM" or "up HH:MM" or "up X min"
  const upMatch = raw.match(/up\s+(.+?)(?:,\s*\d+\s+user|$)/);
  if (!upMatch) return raw;

  const upPart = upMatch[1].trim().replace(/,\s*$/, "");
  const daysMatch = upPart.match(/(\d+)\s+days?/);
  const timeMatch = upPart.match(/(\d+):(\d+)/);
  const minMatch = upPart.match(/(\d+)\s+min/);

  const days = daysMatch ? parseInt(daysMatch[1], 10) : 0;
  let hours = 0;
  let minutes = 0;

  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = parseInt(timeMatch[2], 10);
  } else if (minMatch) {
    minutes = parseInt(minMatch[1], 10);
  }

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

  return parts.join(" ");
}

function parseCpu(section: string): string {
  const line = section.trim();
  const match = line.match(/model name\s*:\s*(.+)/i);
  return match ? match[1].trim() : "Unknown";
}

function parseSystemInfo(raw: string): SystemInfo {
  const sections = raw.split("---DELIM---");

  return {
    os: sections[0]?.trim() ?? "Unknown",
    cpu: parseCpu(sections[1] ?? ""),
    ram: parseRam(sections[2] ?? ""),
    disks: parseDisks(sections[3] ?? ""),
    uptime: parseUptime(sections[4] ?? ""),
    ips: (sections[5]?.trim() ?? "").split(/\s+/).filter(Boolean),
  };
}

function OverviewTab({ sessionId }: OverviewTabProps) {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await tauriInvoke<string>("ssh_exec", {
        sessionId,
        command: COMMAND,
      });
      setInfo(parseSystemInfo(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void fetchInfo();
  }, [fetchInfo]);

  if (loading) return <OverviewSkeleton />;

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Failed to load system info</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>{error}</span>
          <Button variant="outline" size="sm" className="w-fit" onClick={() => void fetchInfo()}>
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!info) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button variant="ghost" size="sm" onClick={() => void fetchInfo()}>
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InfoCard icon={Monitor} label="OS / Kernel" value={info.os} />
        <InfoCard icon={Cpu} label="CPU Model" value={info.cpu} />
        <InfoCard
          icon={Cpu}
          label="RAM"
          value={`${info.ram.used} GB used / ${info.ram.total} GB total (${info.ram.free} GB free)`}
        />
        <InfoCard icon={Timer} label="Uptime" value={info.uptime} />
        <InfoCard
          icon={Network}
          label="IP Addresses"
          value={info.ips.length > 0 ? info.ips.join(", ") : "None detected"}
        />
        <DiskCard disks={info.disks} />
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="gap-1.5 px-4 py-0">
        <CardTitle className="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
          <Icon className="size-4" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <p className="text-sm break-all leading-relaxed">{value}</p>
      </CardContent>
    </Card>
  );
}

function DiskCard({ disks }: { disks: DiskEntry[] }) {
  return (
    <Card className="gap-3 py-4 md:col-span-2">
      <CardHeader className="gap-1.5 px-4 py-0">
        <CardTitle className="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
          <HardDrive className="size-4" />
          Disk Usage
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {disks.length === 0 ? (
          <p className="text-muted-foreground text-sm">No disk information available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs uppercase tracking-wider">
                  <th className="pb-2 pr-4 font-medium">Filesystem</th>
                  <th className="pb-2 pr-4 font-medium">Size</th>
                  <th className="pb-2 pr-4 font-medium">Used</th>
                  <th className="pb-2 pr-4 font-medium">Avail</th>
                  <th className="pb-2 pr-4 font-medium">Use%</th>
                  <th className="pb-2 font-medium">Mounted On</th>
                </tr>
              </thead>
              <tbody>
                {disks.map((d) => (
                  <tr key={d.mountedOn} className="border-b last:border-0">
                    <td className="py-1.5 pr-4 font-mono text-xs">{d.filesystem}</td>
                    <td className="py-1.5 pr-4">{d.size}</td>
                    <td className="py-1.5 pr-4">{d.used}</td>
                    <td className="py-1.5 pr-4">{d.avail}</td>
                    <td className="py-1.5 pr-4">{d.usePercent}</td>
                    <td className="py-1.5 font-mono text-xs">{d.mountedOn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className={`h-28 ${i === 4 ? "md:col-span-2" : ""}`} />
        ))}
      </div>
    </div>
  );
}

export { OverviewTab };
export type { OverviewTabProps };
