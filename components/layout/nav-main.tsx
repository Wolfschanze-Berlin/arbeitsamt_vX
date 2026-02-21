"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Terminal,
  MessageSquare,
  Github,
  KanbanSquare,
  Layers,
  Server,
  Cloud,
  Settings,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type NavSubItem = {
  name: string;
  path: string;
};

type NavItem = {
  name: string;
  icon: LucideIcon;
  path?: string;
  subItems?: NavSubItem[];
};

const mainNavItems: NavItem[] = [
  {
    icon: LayoutDashboard,
    name: "Dashboard",
    subItems: [{ name: "Overview", path: "/" }],
  },
  { icon: Layers, name: "Die Zentral", path: "/zentral" },
  { icon: Server, name: "Servers", path: "/servers" },
  { icon: Cloud, name: "Cloud", path: "/cloud" },
  { icon: Terminal, name: "SSH Terminal", path: "/ssh" },
  { icon: MessageSquare, name: "Chat", path: "/chat" },
  {
    icon: Github,
    name: "GitHub",
    subItems: [
      { name: "Overview", path: "/github" },
      { name: "Repositories", path: "/github/repos" },
      { name: "Starred", path: "/github/starred" },
    ],
  },
  { icon: KanbanSquare, name: "Kanban", path: "/kanban" },
  { icon: Settings, name: "Settings", path: "/settings" },
];

function NavItemComponent({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = item.path ? pathname === item.path : false;
  const isSubActive =
    item.subItems?.some(
      (sub) => pathname === sub.path || pathname.startsWith(sub.path + "/")
    ) ?? false;

  if (item.subItems) {
    return (
      <Collapsible defaultOpen={isSubActive} className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton isActive={isSubActive} tooltip={item.name}>
              <item.icon className="size-4" />
              <span>{item.name}</span>
              <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.subItems.map((sub) => (
                <SidebarMenuSubItem key={sub.path}>
                  <SidebarMenuSubButton asChild isActive={pathname === sub.path}>
                    <Link href={sub.path}>{sub.name}</Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
        <Link href={item.path!}>
          <item.icon className="size-4" />
          <span>{item.name}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function NavMain() {
  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Menu</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {mainNavItems.map((item) => (
              <NavItemComponent key={item.name} item={item} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
