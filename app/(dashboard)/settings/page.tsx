"use client";

import { Palette, Terminal, ServerCog, RefreshCw } from "lucide-react";
import {
  SettingsLayout,
  type SettingsSection,
} from "@/components/dashboard/settings/SettingsLayout";
import { AppearanceSettings } from "@/components/dashboard/settings/sections/AppearanceSettings";
import { SshProfilesSettings } from "@/components/dashboard/settings/sections/SshProfilesSettings";
import { TerminalSettings } from "@/components/dashboard/settings/sections/TerminalSettings";
import { UpdatesSettings } from "@/components/dashboard/settings/sections/UpdatesSettings";

const sections: SettingsSection[] = [
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    component: <AppearanceSettings />,
  },
  {
    id: "ssh-profiles",
    label: "SSH Profiles",
    icon: ServerCog,
    component: <SshProfilesSettings />,
  },
  {
    id: "terminal",
    label: "Terminal",
    icon: Terminal,
    component: <TerminalSettings />,
  },
  {
    id: "updates",
    label: "Updates & About",
    icon: RefreshCw,
    component: <UpdatesSettings />,
  },
];

export default function SettingsPage() {
  return <SettingsLayout sections={sections} />;
}
