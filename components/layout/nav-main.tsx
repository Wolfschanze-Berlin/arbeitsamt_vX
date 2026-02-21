"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Calendar,
  UserCircle,
  List,
  Table2,
  FileText,
  PieChart,
  Box,
  Plug,
  Terminal,
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
  { icon: Terminal, name: "SSH Terminal", path: "/ssh" },
  { icon: Calendar, name: "Calendar", path: "/calendar" },
  { icon: UserCircle, name: "User Profile", path: "/profile" },
  {
    icon: List,
    name: "Forms",
    subItems: [{ name: "Form Elements", path: "/form-elements" }],
  },
  {
    icon: Table2,
    name: "Tables",
    subItems: [{ name: "Basic Tables", path: "/basic-tables" }],
  },
  {
    icon: FileText,
    name: "Pages",
    subItems: [
      { name: "Blank Page", path: "/blank" },
      { name: "404 Error", path: "/error-404" },
    ],
  },
];

const othersNavItems: NavItem[] = [
  { icon: Terminal, name: "Greet Demo", path: "/greet" },
  {
    icon: PieChart,
    name: "Charts",
    subItems: [
      { name: "Line Chart", path: "/line-chart" },
      { name: "Bar Chart", path: "/bar-chart" },
    ],
  },
  {
    icon: Box,
    name: "UI Elements",
    subItems: [
      { name: "Alerts", path: "/alerts" },
      { name: "Buttons", path: "/buttons" },
      { name: "Badge", path: "/badge" },
    ],
  },
  {
    icon: Plug,
    name: "Authentication",
    subItems: [
      { name: "Sign In", path: "/signin" },
      { name: "Sign Up", path: "/signup" },
    ],
  },
];

function NavItemComponent({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = item.path ? pathname === item.path : false;
  const isSubActive = item.subItems?.some((sub) => pathname === sub.path) ?? false;

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
      <SidebarGroup>
        <SidebarGroupLabel>Others</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {othersNavItems.map((item) => (
              <NavItemComponent key={item.name} item={item} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
