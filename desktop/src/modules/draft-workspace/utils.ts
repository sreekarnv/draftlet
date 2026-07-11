import type {
  Conversation,
  Coverage,
  DraftStatus,
  DraftVariant,
  Length,
  Tone,
} from "@/lib/contracts";
import type { DraftSource } from "@/modules/draft-workspace/types";

export const COVERAGE_TAILS: Record<Coverage, string> = {
  Brief: "Happy to elaborate if useful.",
  "Answer all points": "Let me know if you want any of this reworded or expanded.",
  Detailed: "Let me know if any of these land in the wrong place and I'll iterate.",
};

export const LENGTH_TAILS: Record<Length, string> = {
  Short: "I'll follow up shortly with the next step.",
  Medium: "I'll send a fuller note shortly with the supporting detail.",
  Long: "I'll send a more detailed pass shortly that walks through each point you raised.",
};

export const toneOptions: readonly Tone[] = ["Direct", "Warm", "Formal", "Friendly"];
export const lengthOptions: readonly Length[] = ["Short", "Medium", "Long"];
export const coverageOptions: readonly Coverage[] = ["Brief", "Answer all points", "Detailed"];

const STATUS_LABELS: Record<DraftStatus, string> = {
  generating: "Generating",
  ready: "Ready for review",
  accepted: "Accepted",
  sent: "Sent",
};

function buildVariantBody(
  conversation: Conversation,
  tone: Tone,
  length: Length,
  coverage: Coverage,
): { text: string; greetingTone: string } {
  const greetingTone =
    tone === "Warm" || tone === "Friendly"
      ? `Hi ${conversation.contact}`
      : `Hello ${conversation.contact}`;

  const opener = conversation.latestMessage
    ? `Thanks for your note about "${conversation.latestMessage.slice(0, 60)}${conversation.latestMessage.length > 60 ? "…" : ""}".`
    : "Thanks for the note.";

  const text = `${greetingTone},

${opener} ${LENGTH_TAILS[length]}

${COVERAGE_TAILS[coverage]}

Best`;

  return { text, greetingTone };
}

export function generateDraftVariant(
  conversation: Conversation,
  options: { tone: Tone; length: Length; coverage: Coverage; variantNumber: number },
): DraftVariant {
  const { tone, length, coverage, variantNumber } = options;
  const { text, greetingTone } = buildVariantBody(conversation, tone, length, coverage);
  const detailLine = `${greetingTone} · ${LENGTH_TAILS[length]} · ${COVERAGE_TAILS[coverage]}`;

  return {
    id: crypto.randomUUID(),
    title: `${tone} ${length.toLowerCase()} · ${coverage.toLowerCase()} #${variantNumber}`,
    detail: detailLine,
    body: text,
  };
}

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
