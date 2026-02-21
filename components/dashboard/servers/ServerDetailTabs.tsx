"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Container, LayoutDashboard } from "lucide-react";
import { OverviewTab } from "@/components/dashboard/servers/tabs/OverviewTab";
import { MetricsTab } from "@/components/dashboard/servers/tabs/MetricsTab";
import { DockerTab } from "@/components/dashboard/servers/tabs/DockerTab";

interface ServerDetailTabsProps {
  sessionId: string;
  host: string;
}

function ServerDetailTabs({ sessionId, host }: ServerDetailTabsProps) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
      <TabsList variant="line" className="w-full justify-start border-b px-2">
        <TabsTrigger value="overview" className="gap-1.5">
          <LayoutDashboard className="size-4" />
          Overview
        </TabsTrigger>
        <TabsTrigger value="monitor" className="gap-1.5">
          <Activity className="size-4" />
          System Monitor
        </TabsTrigger>
        <TabsTrigger value="docker" className="gap-1.5">
          <Container className="size-4" />
          Docker
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="flex-1 overflow-y-auto p-4">
        <OverviewTab sessionId={sessionId} />
      </TabsContent>

      <TabsContent value="monitor" className="flex-1 overflow-y-auto p-4">
        <MetricsTab sessionId={sessionId} isActive={activeTab === "monitor"} />
      </TabsContent>

      <TabsContent value="docker" className="flex-1 overflow-y-auto p-4">
        <DockerTab sessionId={sessionId} />
      </TabsContent>
    </Tabs>
  );
}

export { ServerDetailTabs };
export type { ServerDetailTabsProps };
