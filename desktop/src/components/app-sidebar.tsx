import type * as React from "react";
import { Link } from "react-router";
import { Command } from "lucide-react";

import { draftletNavigation } from "@/lib/navigation";
import { useRuntimeStatus } from "@/lib/runtime-status";
import { StatusDot } from "@/components/status-dot";
import { cn } from "@/shared/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/shared/components/ui/sidebar";

const workspacePaths = new Set(["/", "/messages", "/library", "/drafts", "/connectors", "/search"]);
const workspaceNavigation = draftletNavigation.filter((item) => workspacePaths.has(item.path));
const systemNavigation = draftletNavigation.filter((item) => !workspacePaths.has(item.path));

interface StatusRowProps {
  label: string;
  value: string;
  tone: React.ComponentProps<typeof StatusDot>["tone"];
}

function StatusRow({ label, value, tone }: StatusRowProps) {
  return (
    <div className="flex items-center gap-2 px-0.5 py-1.5 text-xs">
      <StatusDot tone={tone} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sidebar-foreground/55">
          <span className="text-sidebar-foreground/80">{label}</span>: {value}
        </div>
      </div>
    </div>
  );
}

interface NavigationGroupProps {
  label: string;
  items: typeof draftletNavigation;
  activePath: string;
}

function NavigationGroup({ label, items, activePath }: NavigationGroupProps) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="px-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {items.map((item) => {
            const isActive = item.path === activePath;

            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.title}
                  className={cn(
                    "relative h-8 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                    isActive &&
                      "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:absolute before:left-1 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary",
                  )}
                >
                  <Link to={item.path} aria-current={isActive ? "page" : undefined}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  activePath: string;
};

export function AppSidebar({ activePath, ...props }: AppSidebarProps) {
  const runtime = useRuntimeStatus();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar" {...props}>
      <SidebarHeader className="h-14 justify-center px-2 py-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Draftlet">
              <Link to="/">
                <div className="flex aspect-square size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                  <Command className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold tracking-tight">Draftlet</span>
                  <span className="truncate text-xs text-sidebar-foreground/55">
                    Local drafting companion
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator className="opacity-60" />

      <SidebarContent className="gap-1 px-1 py-2">
        <NavigationGroup label="Workspace" items={workspaceNavigation} activePath={activePath} />
        <NavigationGroup label="System" items={systemNavigation} activePath={activePath} />
      </SidebarContent>

      <SidebarFooter className="gap-2 px-3 py-3 group-data-[collapsible=icon]:hidden">
        <div className="px-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/45">
          Local status
        </div>
        <div className="space-y-1">
          <StatusRow
            label="Draftlet Runtime"
            value={runtime.runtime === "ready" ? "Connected" : "Not connected"}
            tone={runtime.runtime}
          />
          <StatusRow
            label="Ollama Provider"
            value={runtime.ollama === "ready" ? "Available" : "Not connected"}
            tone={runtime.ollama}
          />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
