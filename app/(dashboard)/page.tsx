"use client";

import { MetricsGrid } from "@/components/dashboard/metrics-grid";
import { MonthlySalesChart } from "@/components/dashboard/monthly-sales-chart";
import { MonthlyTarget } from "@/components/dashboard/monthly-target";
import { StatisticsChart } from "@/components/dashboard/statistics-chart";
import { DemographicCard } from "@/components/dashboard/demographic-card";
import { RecentOrdersTable } from "@/components/dashboard/recent-orders-table";

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      <div className="col-span-12 space-y-6 xl:col-span-7">
        <MetricsGrid />
        <MonthlySalesChart />
      </div>

      <div className="col-span-12 xl:col-span-5">
        <MonthlyTarget />
      </div>

      <div className="col-span-12">
        <StatisticsChart />
      </div>

      <div className="col-span-12 xl:col-span-5">
        <DemographicCard />
      </div>

      <div className="col-span-12 xl:col-span-7">
        <RecentOrdersTable />
      </div>
    </div>
  );
}
