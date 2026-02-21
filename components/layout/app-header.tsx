"use client";

import { useRef, useEffect } from "react";
import { Bell, Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NavUser } from "@/components/layout/nav-user";

export function AppHeader() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-2 border-b bg-background px-4 lg:h-16 lg:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-2 h-6" />

      {/* Search */}
      <div className="hidden flex-1 lg:block">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search or type command..."
            className="h-10 w-full rounded-lg border border-input bg-transparent pl-10 pr-14 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right side actions */}
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <Button variant="outline" size="icon" className="relative size-10 rounded-full">
          <Bell className="size-5" />
          <span className="absolute right-0 top-0.5 size-2 rounded-full bg-orange-400" />
        </Button>
        <NavUser />
      </div>
    </header>
  );
}
