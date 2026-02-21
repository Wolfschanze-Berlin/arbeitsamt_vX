"use client";

import { Users, Package } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";

const metrics = [
  {
    icon: Users,
    label: "Customers",
    value: "3,782",
    trend: { value: "11.01%", direction: "up" as const },
  },
  {
    icon: Package,
    label: "Orders",
    value: "5,359",
    trend: { value: "9.05%", direction: "down" as const },
  },
];

export function MetricsGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
      {metrics.map((m) => (
        <MetricCard key={m.label} {...m} />
      ))}
    </div>
  );
}
