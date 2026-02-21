"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Palette,
  Terminal,
  ServerCog,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

interface SettingsSection {
  id: string;
  label: string;
  icon: LucideIcon;
  component: React.ReactNode;
}

interface SettingsLayoutProps {
  sections: SettingsSection[];
  defaultSection?: string;
}

export function SettingsLayout({
  sections,
  defaultSection,
}: SettingsLayoutProps) {
  const [activeSection, setActiveSection] = useState(
    defaultSection ?? sections[0]?.id ?? "",
  );

  const active = sections.find((s) => s.id === activeSection);

  return (
    <div className="flex h-full gap-6 p-6">
      {/* Left nav */}
      <nav className="w-[170px] shrink-0">
        <h2 className="mb-4 text-lg font-semibold">Settings</h2>
        <div className="flex flex-col gap-1">
          {sections.map((section) => (
            <Button
              key={section.id}
              variant="ghost"
              size="sm"
              className={cn(
                "justify-start gap-2",
                activeSection === section.id &&
                  "bg-muted font-medium",
              )}
              onClick={() => setActiveSection(section.id)}
            >
              <section.icon className="size-4" />
              {section.label}
            </Button>
          ))}
        </div>
      </nav>

      {/* Content panel */}
      <ScrollArea className="flex-1">
        <div className="max-w-2xl space-y-6">
          {active && (
            <>
              <h3 className="text-xl font-semibold">{active.label}</h3>
              {active.component}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export { type SettingsSection };
export const SECTION_ICONS = { Palette, Terminal, ServerCog, RefreshCw };
