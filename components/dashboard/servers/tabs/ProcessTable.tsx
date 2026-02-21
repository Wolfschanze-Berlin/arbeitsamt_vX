"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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

const COLUMNS: { key: SortField; label: string; align: string }[] = [
  { key: "pid", label: "PID", align: "text-right" },
  { key: "name", label: "Command", align: "text-left" },
  { key: "cpu_pct", label: "CPU%", align: "text-right" },
  { key: "mem_pct", label: "MEM%", align: "text-right" },
  { key: "state", label: "S", align: "text-center" },
];

function stateLabel(state: string): { text: string; cls: string } {
  switch (state.toUpperCase()) {
    case "R": return { text: "R", cls: "text-green-400" };
    case "S": return { text: "S", cls: "text-slate-500" };
    case "I": return { text: "I", cls: "text-slate-600" };
    case "D": return { text: "D", cls: "text-yellow-400" };
    case "Z": return { text: "Z", cls: "text-red-400" };
    case "T": return { text: "T", cls: "text-orange-400" };
    default: return { text: state, cls: "text-slate-500" };
  }
}

function cpuCellColor(pct: number): string {
  if (pct > 80) return "text-red-400";
  if (pct > 50) return "text-yellow-400";
  if (pct > 20) return "text-green-400";
  return "text-slate-400";
}

function memCellColor(pct: number): string {
  if (pct > 80) return "text-red-400";
  if (pct > 50) return "text-yellow-400";
  if (pct > 20) return "text-blue-400";
  return "text-slate-400";
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
          p.name.toLowerCase().includes(filter.toLowerCase()),
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
    return result.slice(0, 30);
  }, [processes, filter, sortField, sortDir]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="size-2.5 opacity-30" />;
    return sortDir === "asc" ? (
      <ArrowUp className="size-2.5 text-cyan-400" />
    ) : (
      <ArrowDown className="size-2.5 text-cyan-400" />
    );
  };

  return (
    <div className="flex h-full flex-col font-mono text-[11px]">
      {/* Filter row */}
      <div className="border-b border-slate-700/50 px-2 py-1">
        <input
          type="text"
          placeholder="filter..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full bg-transparent text-[11px] text-slate-300 placeholder:text-slate-600 focus:outline-none"
        />
      </div>

      {/* Header */}
      <div className="flex items-center gap-1 border-b border-slate-700/50 bg-slate-900/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {COLUMNS.map((col) => (
          <button
            key={col.key}
            type="button"
            onClick={() => handleSort(col.key)}
            className={cn(
              "flex items-center gap-0.5 transition-colors hover:text-slate-300",
              col.key === "pid" && "w-14 justify-end",
              col.key === "name" && "flex-1 justify-start",
              col.key === "cpu_pct" && "w-14 justify-end",
              col.key === "mem_pct" && "w-14 justify-end",
              col.key === "state" && "w-6 justify-center",
              sortField === col.key && "text-cyan-400",
            )}
          >
            {col.label}
            <SortIcon field={col.key} />
          </button>
        ))}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="px-2 py-4 text-center text-slate-600">
            No processes
          </div>
        ) : (
          sorted.map((proc) => {
            const st = stateLabel(proc.state);
            return (
              <div
                key={proc.pid}
                className="flex items-center gap-1 border-b border-slate-800/30 px-2 py-px leading-snug hover:bg-slate-800/30"
              >
                <span className="w-14 text-right tabular-nums text-slate-500">
                  {proc.pid}
                </span>
                <span className="flex-1 truncate text-slate-300">
                  {proc.name}
                </span>
                <span className={cn("w-14 text-right tabular-nums", cpuCellColor(proc.cpu_pct))}>
                  {proc.cpu_pct.toFixed(1)}
                </span>
                <span className={cn("w-14 text-right tabular-nums", memCellColor(proc.mem_pct))}>
                  {proc.mem_pct.toFixed(1)}
                </span>
                <span className={cn("w-6 text-center", st.cls)}>
                  {st.text}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export { ProcessTable };
export type { ProcessTableProps, ProcessInfo };
