"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcessInfo {
  pid: number;
  name: string;
  cpu_pct: number;
  mem_pct: number;
  state: string;
  vsz: number;
}

interface ProcessTableProps {
  processes: ProcessInfo[];
}

type SortField = "pid" | "name" | "cpu_pct" | "mem_pct" | "state";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortField; label: string; width: string }[] = [
  { key: "pid", label: "PID", width: "w-[72px]" },
  { key: "name", label: "Process Name", width: "flex-1 min-w-[140px]" },
  { key: "cpu_pct", label: "CPU%", width: "w-[120px]" },
  { key: "mem_pct", label: "MEM%", width: "w-[120px]" },
  { key: "state", label: "State", width: "w-[72px]" },
];

function stateColor(state: string): string {
  switch (state.toUpperCase()) {
    case "R":
      return "text-green-500";
    case "S":
    case "I":
      return "text-muted-foreground";
    case "D":
      return "text-yellow-500";
    case "Z":
      return "text-red-500";
    case "T":
      return "text-orange-400";
    default:
      return "text-muted-foreground";
  }
}

function MiniBar({ value, color }: { value: number; color: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted relative h-1.5 w-16 overflow-hidden rounded-full">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-300", color)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="w-10 text-right tabular-nums">{value.toFixed(1)}</span>
    </div>
  );
}

function ProcessTable({ processes }: ProcessTableProps) {
  const [filter, setFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("cpu_pct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    const filtered = filter
      ? processes.filter((p) =>
          p.name.toLowerCase().includes(filter.toLowerCase())
        )
      : processes;

    const compare = (a: ProcessInfo, b: ProcessInfo): number => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return aVal.localeCompare(bVal);
      }
      return (aVal as number) - (bVal as number);
    };

    const result = [...filtered].sort(compare);
    if (sortDir === "desc") result.reverse();
    return result.slice(0, 20);
  }, [processes, filter, sortField, sortDir]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="size-3 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="size-3" />
    ) : (
      <ArrowDown className="size-3" />
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative max-w-xs">
        <Search className="text-muted-foreground absolute left-2 top-1/2 size-4 -translate-y-1/2" />
        <Input
          placeholder="Filter processes..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-7 pl-8 text-xs"
        />
      </div>

      <div className="border-border overflow-hidden rounded-md border">
        {/* Header */}
        <div className="bg-muted/50 flex items-center border-b px-3 py-1.5 text-xs font-medium">
          {COLUMNS.map((col) => (
            <button
              key={col.key}
              type="button"
              onClick={() => handleSort(col.key)}
              className={cn(
                "flex items-center gap-1 hover:text-foreground transition-colors",
                col.width,
                sortField === col.key ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {col.label}
              <SortIcon field={col.key} />
            </button>
          ))}
        </div>

        {/* Rows */}
        <div className="max-h-[280px] overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="text-muted-foreground px-3 py-4 text-center text-xs">
              No processes match filter
            </div>
          ) : (
            sorted.map((proc) => (
              <div
                key={proc.pid}
                className="hover:bg-muted/30 flex items-center border-b px-3 py-1 text-xs last:border-0"
              >
                <span className="text-muted-foreground w-[72px] tabular-nums">
                  {proc.pid}
                </span>
                <span className="min-w-[140px] flex-1 truncate font-mono">
                  {proc.name}
                </span>
                <span className="w-[120px]">
                  <MiniBar
                    value={proc.cpu_pct}
                    color={proc.cpu_pct > 80 ? "bg-red-500" : proc.cpu_pct > 50 ? "bg-yellow-500" : "bg-blue-500"}
                  />
                </span>
                <span className="w-[120px]">
                  <MiniBar
                    value={proc.mem_pct}
                    color={proc.mem_pct > 80 ? "bg-red-500" : proc.mem_pct > 50 ? "bg-yellow-500" : "bg-emerald-500"}
                  />
                </span>
                <span className={cn("w-[72px] text-center font-mono", stateColor(proc.state))}>
                  {proc.state}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export { ProcessTable };
export type { ProcessTableProps, ProcessInfo };
