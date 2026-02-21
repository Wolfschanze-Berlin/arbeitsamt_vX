"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Priority } from "@/lib/kanban/types";

interface PriorityBadgeProps {
  priority: Priority;
}

const PRIORITY_CLASSES: Record<Priority, string> = {
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

function PriorityBadge({ priority }: PriorityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        PRIORITY_CLASSES[priority]
      )}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export { PriorityBadge };
export type { PriorityBadgeProps };
