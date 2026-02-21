"use client";

import { ArrowUp, ArrowDown, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  trend: {
    value: string;
    direction: "up" | "down";
  };
};

export function MetricCard({ icon: Icon, label, value, trend }: MetricCardProps) {
  const isUp = trend.direction === "up";

  return (
    <div className="rounded-2xl border bg-card p-5 md:p-6">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
        <Icon className="size-6 text-foreground" />
      </div>
      <div className="mt-5 flex items-end justify-between">
        <div>
          <span className="text-sm text-muted-foreground">{label}</span>
          <h4 className="mt-2 text-[30px] font-bold leading-[38px]">{value}</h4>
        </div>
        <Badge variant={isUp ? "default" : "destructive"} className="gap-1">
          {isUp ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
          {trend.value}
        </Badge>
      </div>
    </div>
  );
}
