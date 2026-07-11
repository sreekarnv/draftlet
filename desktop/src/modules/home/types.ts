import type { DraftStatus } from "@/lib/contracts";
import type { LucideIcon } from "lucide-react";

export type ActivityItem = {
  title: string;
  detail: string;
  connector?: string;
  status?: DraftStatus;
};

export type StatusItem = {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  state: string;
};

export type QuickAction = {
  label: string;
  to: string;
  icon: LucideIcon;
  primary: boolean;
};
