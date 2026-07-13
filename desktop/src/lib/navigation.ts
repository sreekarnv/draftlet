import type { LucideIcon } from "lucide-react";
import {
  BookOpenText,
  DraftingCompass,
  Home,
  Library,
  MessageCircle,
  PlugZap,
  Search,
  Settings,
} from "lucide-react";

export type DraftletNavItem = {
  title: string;
  path: string;
  icon: LucideIcon;
  description: string;
};

export const draftletNavigation: DraftletNavItem[] = [
  {
    title: "Home",
    path: "/",
    icon: Home,
    description: "Local writing workspace",
  },
  {
    title: "Messages",
    path: "/messages",
    icon: MessageCircle,
    description: "Local texting companion",
  },
  {
    title: "Library",
    path: "/library",
    icon: Library,
    description: "All local conversation memory",
  },
  {
    title: "Drafts",
    path: "/drafts",
    icon: DraftingCompass,
    description: "Work in progress",
  },
  {
    title: "Connectors",
    path: "/connectors",
    icon: PlugZap,
    description: "Local and external inputs",
  },
  {
    title: "Search",
    path: "/search",
    icon: Search,
    description: "Find drafts and memory",
  },
  {
    title: "Settings",
    path: "/settings",
    icon: Settings,
    description: "Desktop preferences",
  },
  {
    title: "Diagnostics",
    path: "/diagnostics",
    icon: BookOpenText,
    description: "Runtime and connector health",
  },
];
