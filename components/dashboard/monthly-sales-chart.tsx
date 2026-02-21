"use client";

import { MoreHorizontal } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const data = [
  { month: "Jan", sales: 168 },
  { month: "Feb", sales: 385 },
  { month: "Mar", sales: 201 },
  { month: "Apr", sales: 298 },
  { month: "May", sales: 187 },
  { month: "Jun", sales: 195 },
  { month: "Jul", sales: 291 },
  { month: "Aug", sales: 110 },
  { month: "Sep", sales: 215 },
  { month: "Oct", sales: 390 },
  { month: "Nov", sales: 280 },
  { month: "Dec", sales: 112 },
];

export function MonthlySalesChart() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card px-5 pt-5 sm:px-6 sm:pt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Monthly Sales</h3>
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
      <div className="mt-4 h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={12} />
            <YAxis axisLine={false} tickLine={false} fontSize={12} />
            <Tooltip />
            <Bar dataKey="sales" fill="#465fff" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
