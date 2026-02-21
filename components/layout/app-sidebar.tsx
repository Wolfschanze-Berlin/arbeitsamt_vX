"use client";

import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavMain } from "@/components/layout/nav-main";

export function AppSidebar() {
  const { state } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2">
          {state === "expanded" ? (
            <>
              <img
                src="/images/logo/logo.svg"
                alt="Logo"
                className="h-8 dark:hidden"
              />
              <img
                src="/images/logo/logo-dark.svg"
                alt="Logo"
                className="hidden h-8 dark:block"
              />
            </>
          ) : (
            <img
              src="/images/logo/logo-icon.svg"
              alt="Logo"
              className="size-8"
            />
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent className="custom-scrollbar">
        <NavMain />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
