import type { Conversation, DraftStatus, Tone } from "@/lib/contracts";
import type { DraftSource } from "@/modules/draft-workspace/types";

export const toneOptions: readonly Tone[] = ["Direct", "Warm", "Formal", "Friendly"];
export const lengthOptions = ["Short", "Medium", "Long"] as const;
export const coverageOptions = ["Brief", "Answer all points", "Detailed"] as const;

const STATUS_LABELS: Record<DraftStatus, string> = {
  generating: "Generating",
  ready: "Ready for review",
  accepted: "Accepted",
  sent: "Sent",
};

export function getDraftStatusLabel(status: DraftStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function getDraftSource(conversation: Conversation | undefined): DraftSource {
  return {
    title: conversation?.title ?? "Conversation",
    connector: conversation?.connector ?? "Source",
    contact: conversation?.contact ?? "Contact",
  };
}
