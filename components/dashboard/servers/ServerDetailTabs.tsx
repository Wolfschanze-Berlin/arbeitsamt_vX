"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Activity, Container, LayoutDashboard, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OverviewTab } from "@/components/dashboard/servers/tabs/OverviewTab";
import { MetricsTab } from "@/components/dashboard/servers/tabs/MetricsTab";
import { DockerTab } from "@/components/dashboard/servers/tabs/DockerTab";

interface ServerDetailTabsProps {
  sessionId: string;
  host: string;
  /** If set, this is a WSL distro on the host */
  wslDistro?: string;
}

function ServerDetailTabs({ sessionId, host, wslDistro }: ServerDetailTabsProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const router = useRouter();

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-2">
        <div className="flex items-center gap-2">
          <TabsList variant="line" className="border-b-0">
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
          {wslDistro && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              WSL: {wslDistro}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mr-2 gap-1.5"
          onClick={() =>
            router.push(`/ssh?host=${encodeURIComponent(host)}&autoConnect=true`)
          }
        >
          <Terminal className="size-3.5" />
          Open in Terminal
        </Button>
      </div>

      <TabsContent value="overview" className="flex-1 overflow-y-auto p-4">
        <OverviewTab sessionId={sessionId} />
      </TabsContent>

      <TabsContent value="monitor" className="flex-1 overflow-hidden">
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
