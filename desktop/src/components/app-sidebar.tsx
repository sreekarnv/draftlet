import type * as React from "react";
import { Link } from "react-router";
import { ChevronRight, Mail, MessageCircle } from "lucide-react";

import draftletLogo from "../../../.github/assets/logo.webp";
import { draftletNavigation } from "@/lib/navigation";
import type { Conversation } from "@/lib/contracts";
import { useConversationsQuery } from "@/lib/queries/conversations";
import { useRuntimeStatus } from "@/lib/runtime-status";
import { StatusDot } from "@/components/status-dot";
import { cn } from "@/shared/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/components/ui/collapsible";
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

const systemNavigation = draftletNavigation.filter((item) =>
  ["/connectors", "/settings"].includes(item.path),
);

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M21.93 4.14c.28-1.05-.75-1.9-1.72-1.42L2.92 11.18c-1.05.51-.94 2.05.16 2.41l4.36 1.42 1.68 5.31c.33 1.05 1.67 1.33 2.38.5l2.45-2.86 4.42 3.23c.9.66 2.17.16 2.45-.92l3.11-16.13ZM8.21 13.63l8.51-5.28c.4-.25.81.29.47.62l-6.99 6.7-.27 2.83-1.05-3.32-.67-1.55Zm2.57 3.46 1.94-1.86 1.64 1.2-2.94 3.44-.64-2.78Z" />
    </svg>
  );
}

function isMessageConversation(conversation: Conversation) {
  return conversation.connector === "telegram" || conversation.threadKind === "chat";
}

function isEmailConversation(conversation: Conversation) {
  return conversation.connector === "gmail" || conversation.threadKind === "email";
}

function getConversationName(conversation: Conversation) {
  return (
    conversation.title || conversation.contact || conversation.participants || "Untitled thread"
  );
}

function getEmailSender(conversation: Conversation) {
  return (
    conversation.contact || conversation.participants || conversation.title || "Unknown sender"
  );
}

function getConversationIcon(conversation: Conversation, kind: ConversationGroupProps["kind"]) {
  if (conversation.connector === "telegram") return TelegramIcon;
  if (conversation.connector === "gmail" || kind === "email") return Mail;
  return MessageCircle;
}

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

interface ConversationGroupProps {
  label: string;
  conversations: Conversation[];
  activePath: string;
  kind: "messages" | "email";
}

function ConversationGroup({ label, conversations, activePath, kind }: ConversationGroupProps) {
  const Icon = kind === "email" ? Mail : MessageCircle;
  const emptyLabel = kind === "email" ? "No Gmail threads yet" : "No Telegram chats yet";

  return (
    <Collapsible defaultOpen asChild>
      <SidebarGroup className="min-h-0 py-1">
        <SidebarGroupLabel
          asChild
          className="group/section-trigger h-7 px-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:bg-sidebar-accent/45 hover:text-sidebar-foreground"
        >
          <CollapsibleTrigger>
            <ChevronRight className="size-3.5 transition-transform group-data-[state=open]/section-trigger:rotate-90" />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <span className="rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] leading-none text-sidebar-foreground/60">
              {conversations.length}
            </span>
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent className="max-h-[min(34vh,22rem)] overflow-y-auto overscroll-contain pr-1">
            <SidebarMenu className="gap-0.5">
              {conversations.length > 0 ? (
                conversations.map((conversation) => {
                  const href =
                    kind === "email" ? `/email/${conversation.id}` : `/messages/${conversation.id}`;
                  const isActive = activePath === href;
                  const title =
                    kind === "email"
                      ? getEmailSender(conversation)
                      : getConversationName(conversation);
                  const subtitle = kind === "email" ? conversation.title : undefined;
                  const preview = conversation.latestMessage;
                  const RowIcon = getConversationIcon(conversation, kind);

                  return (
                    <SidebarMenuItem key={conversation.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={title}
                        className={cn(
                          "relative h-auto min-h-10 items-start rounded-md py-2 pl-4 pr-2 text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:px-2",
                          isActive &&
                            "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:absolute before:left-2 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary group-data-[collapsible=icon]:before:left-1",
                        )}
                      >
                        <Link to={href} aria-current={isActive ? "page" : undefined}>
                          <RowIcon className="mt-0.5 size-4 shrink-0" />
                          <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                            <span className="block truncate text-sm leading-4">{title}</span>
                            {subtitle ? (
                              <span className="mt-0.5 block truncate text-xs leading-4 text-sidebar-foreground/55">
                                {subtitle}
                              </span>
                            ) : null}
                            {preview ? (
                              <span className="mt-0.5 block truncate text-xs leading-4 text-sidebar-foreground/55">
                                {preview}
                              </span>
                            ) : null}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })
              ) : (
                <SidebarMenuItem>
                  <div className="flex items-center gap-2 rounded-md px-2 py-2 text-xs text-sidebar-foreground/45 group-data-[collapsible=icon]:justify-center">
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate group-data-[collapsible=icon]:hidden">
                      {emptyLabel}
                    </span>
                  </div>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

interface SystemGroupProps {
  activePath: string;
}

function SystemGroup({ activePath }: SystemGroupProps) {
  if (systemNavigation.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="px-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        System
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {systemNavigation.map((item) => {
            const isActive = activePath === item.path || activePath.startsWith(`${item.path}/`);
            const Icon = item.icon;

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
                    <Icon />
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
  const conversations = useConversationsQuery().data ?? [];
  const messageConversations = conversations.filter(isMessageConversation);
  const emailConversations = conversations.filter(isEmailConversation);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar" {...props}>
      <SidebarHeader className="h-14 justify-center px-2 py-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Draftlet">
              <Link to="/">
                <div className="flex aspect-square size-7 items-center justify-center overflow-hidden rounded-md bg-sidebar-primary/10 ring-1 ring-sidebar-border">
                  <img src={draftletLogo} alt="" className="size-full object-cover" />
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
        <ConversationGroup
          label="Messages"
          conversations={messageConversations}
          activePath={activePath}
          kind="messages"
        />
        <ConversationGroup
          label="Email"
          conversations={emailConversations}
          activePath={activePath}
          kind="email"
        />
        <SystemGroup activePath={activePath} />
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
