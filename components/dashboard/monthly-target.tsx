"use client";

import { MoreHorizontal, ArrowUp, ArrowDown } from "lucide-react";
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  PolarAngleAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const data = [{ name: "Progress", value: 75.55 }];

export function MonthlyTarget() {
  return (
    <div className="rounded-2xl border bg-muted">
      <div className="rounded-2xl bg-card px-5 pb-11 pt-5 shadow-sm sm:px-6 sm:pt-6">
        <div className="flex justify-between">
          <div>
            <h3 className="text-lg font-semibold">Placement Target</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Placement target for each month
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>View More</DropdownMenuItem>
              <DropdownMenuItem>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Radial chart */}
        <div className="relative mx-auto h-[330px] max-w-[330px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="80%"
              outerRadius="100%"
              startAngle={180}
              endAngle={0}
              data={data}
              barSize={12}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar
                background={{ fill: "hsl(var(--muted))" }}
                dataKey="value"
                cornerRadius={10}
                fill="#465FFF"
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-semibold">75.55%</span>
          </div>
          <span className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-full bg-success-50 px-3 py-1 text-xs font-medium text-success-600 dark:bg-success-500/15 dark:text-success-500">
            +10%
          </span>
        </div>

        <p className="mx-auto mt-10 max-w-[380px] text-center text-sm text-muted-foreground">
          328 placements this month, higher than last month. Keep up the good work!
        </p>
      </div>

      {/* Bottom stats */}
      <div className="flex items-center justify-center gap-5 px-6 py-3.5 sm:gap-8 sm:py-5">
        <StatItem label="Target" value="400" icon={<ArrowDown className="size-4 text-destructive" />} />
        <div className="h-7 w-px bg-border" />
        <StatItem label="Placed" value="328" icon={<ArrowUp className="size-4 text-success-500" />} />
        <div className="h-7 w-px bg-border" />
        <StatItem label="Today" value="12" icon={<ArrowUp className="size-4 text-success-500" />} />
      </div>
    </div>
  );
}

function StatItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-center text-xs text-muted-foreground sm:text-sm">{label}</p>
      <p className="flex items-center justify-center gap-1 text-base font-semibold sm:text-lg">
        {value} {icon}
      </p>
    </div>
  );
}
