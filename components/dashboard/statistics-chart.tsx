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
  { month: "Jan", sales: 180, revenue: 40 },
  { month: "Feb", sales: 190, revenue: 30 },
  { month: "Mar", sales: 170, revenue: 50 },
  { month: "Apr", sales: 160, revenue: 40 },
  { month: "May", sales: 175, revenue: 55 },
  { month: "Jun", sales: 165, revenue: 40 },
  { month: "Jul", sales: 170, revenue: 70 },
  { month: "Aug", sales: 205, revenue: 100 },
  { month: "Sep", sales: 230, revenue: 110 },
  { month: "Oct", sales: 210, revenue: 120 },
  { month: "Nov", sales: 240, revenue: 150 },
  { month: "Dec", sales: 235, revenue: 140 },
];

export function StatisticsChart() {
  return (
    <div className="rounded-2xl border bg-card px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
      <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Statistics</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Target you've set for each month
          </p>
        </div>
        <ChartPeriodToggle />
      </div>
      <div className="h-[310px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#465FFF" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#465FFF" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
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
              dataKey="sales"
              stroke="#465FFF"
              strokeWidth={2}
              fill="url(#salesGradient)"
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#9CB9FF"
              strokeWidth={2}
              fill="url(#revenueGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
