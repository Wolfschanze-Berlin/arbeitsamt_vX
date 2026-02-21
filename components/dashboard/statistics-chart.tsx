"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartPeriodToggle } from "@/components/dashboard/chart-period-toggle";

const data = [
  { month: "Jan", placements: 180, applications: 40 },
  { month: "Feb", placements: 190, applications: 30 },
  { month: "Mar", placements: 170, applications: 50 },
  { month: "Apr", placements: 160, applications: 40 },
  { month: "May", placements: 175, applications: 55 },
  { month: "Jun", placements: 165, applications: 40 },
  { month: "Jul", placements: 170, applications: 70 },
  { month: "Aug", placements: 205, applications: 100 },
  { month: "Sep", placements: 230, applications: 110 },
  { month: "Oct", placements: 210, applications: 120 },
  { month: "Nov", placements: 240, applications: 150 },
  { month: "Dec", placements: 235, applications: 140 },
];

export function StatisticsChart() {
  return (
    <div className="rounded-2xl border bg-card px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
      <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Statistics</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Placements and applications over time
          </p>
        </div>
        <ChartPeriodToggle />
      </div>
      <div className="h-[310px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="placementsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#465FFF" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#465FFF" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="applicationsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#9CB9FF" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#9CB9FF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={12} />
            <YAxis axisLine={false} tickLine={false} fontSize={12} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="placements"
              stroke="#465FFF"
              strokeWidth={2}
              fill="url(#placementsGradient)"
            />
            <Area
              type="monotone"
              dataKey="applications"
              stroke="#9CB9FF"
              strokeWidth={2}
              fill="url(#applicationsGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
