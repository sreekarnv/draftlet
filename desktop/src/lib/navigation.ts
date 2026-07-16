import type { LucideIcon } from "lucide-react";
import { Cable, Mail, MessageCircle, Settings } from "lucide-react";

export type DraftletNavItem = {
  title: string;
  path: string;
  icon: LucideIcon;
  description: string;
};

export const draftletNavigation: DraftletNavItem[] = [
  {
    title: "Messages",
    path: "/messages",
    icon: MessageCircle,
    description: "Local texting companion",
  },
  {
    title: "Email",
    path: "/email",
    icon: Mail,
    description: "Local email drafting companion",
  },
  {
    title: "Connectors",
    path: "/connectors",
    icon: Cable,
    description: "Manage local capture sources",
  },
  {
    title: "Settings",
    path: "/settings",
    icon: Settings,
    description: "Desktop preferences",
  },
];
