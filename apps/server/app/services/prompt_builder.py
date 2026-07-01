from dataclasses import dataclass
import re
from typing import Literal

from app.schemas.domain import ConversationThreadSnapshot, TurnRead
from app.schemas.reply_request import ReplyRequest


DELIMITER = "---"
MAX_CONTEXT_CHARS = 6000
MAX_VARIANT_CHARS = 1800
MAX_THREAD_CONTEXT_CHARS = 1200

SHORT_SOURCE_CHARS = 400
MEDIUM_SOURCE_CHARS = 1500

SourceLength = Literal["short", "medium", "long"]

QUESTION_RE = re.compile(r"\?")
ASK_RE = re.compile(
    r"\b(please|can you|could you|would you|will you|need|needs|ask|request|confirm|send|share|review|approve|sign off|follow up|reply|respond)\b",
    re.IGNORECASE,
)
DATE_OR_COMMITMENT_RE = re.compile(
    r"\b(today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|q[1-4]|eod|eow|noon|deadline|due|by\s+\w+|commit|committed|promise|agreed|will|won't|cannot|can't|must)\b|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b",
    re.IGNORECASE,
)
NAME_RE = re.compile(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b")


@dataclass(frozen=True)
class CompactedContext:
    text: str
    omitted: bool


def build_reply_prompt(request: ReplyRequest, thread_snapshot: ConversationThreadSnapshot | None = None) -> str:
    if request.generation_mode == "refinement":
        return build_refinement_prompt(request, thread_snapshot)

    source = source_text(thread_snapshot, request)
    context = build_context(request, thread_snapshot)
    extras = build_prompt_instructions(request, source, context)

    parts = [
        "You are Draftlet, a local assistant that writes high-quality draft replies.",
        "",
        f"Write exactly 3 replies in a {request.tone} tone.",
        "Each reply must be insertion-ready.",
        f"Separate each reply with exactly this delimiter on its own line: {DELIMITER}",
        "",
        "Rules:",
        "- Do not number the replies.",
        "- Do not include a preamble.",
        "- Do not explain your choices.",
        "- Return only the reply text and delimiters.",
        "- Write replies the user could paste directly into the original conversation.",
        "- Do not invent facts, dates, names, or commitments that are not in the source context.",
        "- If context says content was omitted, do not mention the omission; answer from the preserved details only.",
        *extras,
    ]

    if request.instruction:
        parts.extend([
            "",
            "User instruction:",
            request.instruction,
        ])

    parts.extend([
        "",
        "Source context to reply to:",
        context.text,
    ])

    return "\n".join(parts)


def build_refinement_prompt(request: ReplyRequest, thread_snapshot: ConversationThreadSnapshot | None) -> str:
    latest_variants = preferred_refinement_variants(thread_snapshot, request.turn_id)
    prior_variant_text = "\n\n".join(
        f"Draft {index + 1}:\n{truncate(variant.content, MAX_VARIANT_CHARS)}"
        for index, variant in enumerate(latest_variants)
    )
    source = source_text(thread_snapshot, request)
    context = build_context(request, thread_snapshot)
    extras = build_prompt_instructions(request, source, context)

    parts = [
        "You are Draftlet, a local assistant that refines draft replies.",
        "",
        f"Write exactly 3 refined replies in a {request.tone} tone.",
        "Each reply must be insertion-ready.",
        f"Separate each reply with exactly this delimiter on its own line: {DELIMITER}",
        "",
        "Rules:",
        "- Follow the user's follow-up instruction.",
        "- Preserve factual meaning from the original source and prior drafts.",
        "- Do not invent facts, dates, names, or commitments that are not in the source context.",
        "- Do not number the replies.",
        "- Do not include a preamble.",
        "- Do not explain your choices.",
        "- Return only the reply text and delimiters.",
        "- Write replies the user could paste directly into the original conversation.",
        "- If context says content was omitted, do not mention the omission; answer from the preserved details only.",
        *extras,
        "",
        "Follow-up instruction:",
        request.instruction or "Refine the prior drafts.",
        "",
        "Original source context:",
        context.text,
    ]

    if prior_variant_text:
        parts.extend([
            "",
            "Prior draft variants to refine:",
            prior_variant_text,
        ])

    return "\n".join(parts)


def build_prompt_instructions(request: ReplyRequest, source: str, context: CompactedContext) -> list[str]:
    extras = [
        build_source_depth_instruction(source),
        build_tone_mode_instruction(request),
        build_tone_instruction(request.tone, source),
    ]

    if context.omitted:
        extras.append("- The source context was compacted; preserve every explicit question, ask, date, name, and commitment that remains in the context.")

    return [line for line in extras if line]


def build_context(request: ReplyRequest, thread_snapshot: ConversationThreadSnapshot | None) -> CompactedContext:
    selected = request.selected_text
    selected_context = compact_text(selected, MAX_CONTEXT_CHARS)
    thread_context = compact_thread_context(thread_snapshot, request.turn_id, selected)

    if not thread_context:
        return selected_context

    budget = MAX_CONTEXT_CHARS - len(selected_context.text) - len("\n\nRecent thread context before the selected text:\n")

    if budget <= 120:
        return CompactedContext(
            text=f"{selected_context.text}\n\n[Context omitted: older thread context was omitted because the selected text used the prompt budget.]",
            omitted=True,
        )

    compacted_thread = compact_text(thread_context, min(MAX_THREAD_CONTEXT_CHARS, budget))
    return CompactedContext(
        text=f"{selected_context.text}\n\nRecent thread context before the selected text:\n{compacted_thread.text}",
        omitted=selected_context.omitted or compacted_thread.omitted,
    )


def compact_thread_context(
    thread_snapshot: ConversationThreadSnapshot | None,
    current_turn_id: str | None,
    selected_text: str,
) -> str:
    if not thread_snapshot:
        return ""

    seen = {normalize_for_dedupe(selected_text), normalize_for_dedupe(thread_snapshot.thread.selected_text)}
    lines: list[str] = []

    for turn in recent_prior_turns(thread_snapshot.turns, current_turn_id):
        normalized = normalize_for_dedupe(turn.selected_text)

        if not normalized or normalized in seen:
            continue

        seen.add(normalized)
        lines.append(f"Turn instruction: {turn.instruction}\nTurn source: {turn.selected_text}")

    return "\n\n".join(lines)


def recent_prior_turns(turns: list[TurnRead], current_turn_id: str | None) -> list[TurnRead]:
    prior_turns = [turn for turn in turns if turn.turn_id != current_turn_id]
    return sorted(prior_turns, key=lambda turn: turn.updated_at, reverse=True)


def compact_text(value: str, max_chars: int) -> CompactedContext:
    text = value.strip()

    if len(text) <= max_chars:
        return CompactedContext(text=text, omitted=False)

    marker = "[Context omitted: lower-priority text was compacted deterministically to fit the local prompt budget.]"
    opening_budget = max(400, max_chars // 4)
    closing_budget = max(300, max_chars // 5)
    high_signal_budget = max_chars - opening_budget - closing_budget - len(marker) - 8

    opening = text[:opening_budget].rstrip()
    closing = text[-closing_budget:].lstrip()
    high_signal = join_with_budget(extract_high_signal_sentences(text), high_signal_budget)
    parts = [opening, marker]

    if high_signal:
        parts.extend(["High-signal details preserved:", high_signal])

    parts.append(closing)
    compacted = "\n\n".join(part for part in parts if part)

    if len(compacted) > max_chars:
        compacted = compacted[: max_chars - 3].rstrip() + "..."

    return CompactedContext(text=compacted, omitted=True)


def extract_high_signal_sentences(value: str) -> list[str]:
    sentences = split_sentences(value)
    selected: list[str] = []

    for sentence in sentences:
        if is_high_signal_sentence(sentence):
            selected.append(sentence)

    return dedupe_preserving_order(selected)


def split_sentences(value: str) -> list[str]:
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+|\n+", value) if part.strip()]


def is_high_signal_sentence(sentence: str) -> bool:
    return bool(
        QUESTION_RE.search(sentence)
        or ASK_RE.search(sentence)
        or DATE_OR_COMMITMENT_RE.search(sentence)
        or len(NAME_RE.findall(sentence)) >= 2
    )


def join_with_budget(values: list[str], max_chars: int) -> str:
    if max_chars <= 0:
        return ""

    kept: list[str] = []
    used = 0

    for value in values:
        separator = 2 if kept else 0
        next_length = used + separator + len(value)

        if next_length > max_chars:
            continue

        kept.append(value)
        used = next_length

    return "\n".join(kept)


def dedupe_preserving_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []

    for value in values:
        normalized = normalize_for_dedupe(value)

        if normalized in seen:
            continue

        seen.add(normalized)
        result.append(value)

    return result


def normalize_for_dedupe(value: str) -> str:
    return " ".join(value.lower().split())


def classify_source_length(source_text: str) -> SourceLength:
    length = len(source_text)

    if length <= SHORT_SOURCE_CHARS:
        return "short"

    if length <= MEDIUM_SOURCE_CHARS:
        return "medium"

    return "long"


def build_source_depth_instruction(source_text: str) -> str:
    length = classify_source_length(source_text)

    if length == "short":
        return ""

    if length == "medium":
        return "- Address the main request or question in the source text; cover all key points rather than stopping at a generic acknowledgement."

    return "\n".join(
        [
            "- Identify the sender's main intent, obligations, questions, deadlines, and constraints before drafting.",
            "- Respond to every explicit ask, question, deadline, and required action item in the source text.",
            "- Preserve important factual details such as dates, names, numbers, and commitments from the source.",
            "- Do not collapse the source into a one-line acknowledgement or generic reply.",
            "- Use 2-5 short paragraphs when the source contains multiple distinct points or asks.",
        ]
    )


def build_tone_mode_instruction(request: ReplyRequest) -> str:
    tone = normalize_tone(request.tone)

    if tone == "professional":
        return "- Use a professional tone: polished, direct, respectful, and specific."

    if tone == "casual":
        return "- Use a casual tone: natural, warm, and conversational without becoming sloppy."

    if tone == "short":
        return "- Use a short tone: brief and plain, but still complete enough to answer every required point."

    if tone == "bullet_points":
        return "- Use bullet points only when they make the reply clearer; keep the result ready to paste into the conversation."

    if tone == "custom":
        custom = request.custom_tone_instruction or "Follow the user's custom tone direction without changing the facts."
        return f"- Custom tone instruction: {custom}"

    return ""


def build_tone_instruction(tone: str, source_text: str) -> str:
    if normalize_tone(tone) != "short":
        return ""

    if classify_source_length(source_text) == "short":
        return ""

    return "- 'Short' means compact but complete; cover every required point without adding filler or omitting important details."


def normalize_tone(tone: str) -> str:
    normalized = tone.strip().lower().replace(" ", "_").replace("-", "_")

    if normalized == "friendly":
        return "casual"

    if normalized == "concise":
        return "short"

    return normalized


def preferred_refinement_variants(thread_snapshot: ConversationThreadSnapshot | None, current_turn_id: str | None):
    if not thread_snapshot:
        return []

    accepted = sorted(
        [variant for variant in thread_snapshot.variants if variant.status == "accepted"],
        key=lambda variant: variant.updated_at,
        reverse=True,
    )
    if accepted:
        return [accepted[0]]

    current = sorted(
        [variant for variant in thread_snapshot.variants if variant.is_current],
        key=lambda variant: variant.updated_at,
        reverse=True,
    )
    if current:
        return [current[0]]

    prior_turn_ids = [turn.turn_id for turn in thread_snapshot.turns if turn.turn_id != current_turn_id]

    if not prior_turn_ids:
        return []

    latest_turn_id = prior_turn_ids[-1]
    return sorted(
        [variant for variant in thread_snapshot.variants if variant.turn_id == latest_turn_id],
        key=lambda variant: variant.rank,
    )


def source_text(thread_snapshot: ConversationThreadSnapshot | None, request: ReplyRequest) -> str:
    if thread_snapshot:
        return thread_snapshot.thread.selected_text

    return request.selected_text


def truncate(value: str, max_length: int) -> str:
    if len(value) <= max_length:
        return value

    return f"{value[:max_length - 1]}..."
