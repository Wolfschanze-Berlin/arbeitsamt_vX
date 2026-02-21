"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Period = "monthly" | "quarterly" | "annually";

type ChartPeriodToggleProps = {
  onChange?: (period: Period) => void;
};

const periods: { value: Period; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
];

export function ChartPeriodToggle({ onChange }: ChartPeriodToggleProps) {
  const [selected, setSelected] = useState<Period>("monthly");

  const handleSelect = (period: Period) => {
    setSelected(period);
    onChange?.(period);
  };

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {periods.map((p) => (
        <button
          key={p.value}
          onClick={() => handleSelect(p.value)}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:text-foreground",
            selected === p.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
