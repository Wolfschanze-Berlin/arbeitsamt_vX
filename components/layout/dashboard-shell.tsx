"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { SessionManager } from "@/components/dashboard/terminal";
import { ConnectionDialog } from "@/components/dashboard/ssh/ConnectionDialog";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isSSH = pathname === "/ssh";

  // When switching back to the SSH view, trigger a resize so xterm.js
  // recalculates its dimensions (it can't measure while display:none).
  useEffect(() => {
    if (isSSH) {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
    }
  }, [isSSH]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        {/* SSH terminal — always mounted, hidden when not on /ssh */}
        <div
          className="h-[calc(100vh-64px)]"
          style={{ display: isSSH ? "block" : "none" }}
        >
          <SessionManager
            className="h-full"
            renderConnectionDialog={({ open, onOpenChange, onConnect, isConnecting, error }) => (
              <ConnectionDialog
                open={open}
                onOpenChange={onOpenChange}
                onConnect={onConnect}
                isConnecting={isConnecting}
                error={error}
              />
            )}
          />
        </div>
        {/* Regular page content — hidden when on /ssh */}
        <main style={{ display: isSSH ? "none" : "block" }}>
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
