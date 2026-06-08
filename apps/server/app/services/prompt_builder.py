from app.schemas.domain import ConversationThreadSnapshot
from app.schemas.reply_request import ReplyRequest


DELIMITER = "---"
MAX_CONTEXT_CHARS = 3000
MAX_VARIANT_CHARS = 1800


def build_reply_prompt(request: ReplyRequest, thread_snapshot: ConversationThreadSnapshot | None = None) -> str:
    if request.generation_mode == "refinement":
        return build_refinement_prompt(request, thread_snapshot)

    return "\n".join(
        [
            "You are Draftlet, a local assistant that writes concise draft replies.",
            "",
            f"Write exactly 3 replies in a {request.tone} tone.",
            f"Separate each reply with exactly this delimiter on its own line: {DELIMITER}",
            "",
            "Rules:",
            "- Do not number the replies.",
            "- Do not include a preamble.",
            "- Do not explain your choices.",
            "- Return only the reply text and delimiters.",
            "",
            "Source text to reply to:",
            request.selected_text,
        ]
    )


def build_refinement_prompt(request: ReplyRequest, thread_snapshot: ConversationThreadSnapshot | None) -> str:
    latest_variants = latest_completed_variants(thread_snapshot, request.turn_id)
    prior_variant_text = "\n\n".join(
        f"Draft {index + 1}:\n{truncate(variant.content, MAX_VARIANT_CHARS)}"
        for index, variant in enumerate(latest_variants)
    )

    parts = [
        "You are Draftlet, a local assistant that refines draft replies.",
        "",
        f"Write exactly 3 refined replies in a {request.tone} tone.",
        f"Separate each reply with exactly this delimiter on its own line: {DELIMITER}",
        "",
        "Rules:",
        "- Follow the user's follow-up instruction.",
        "- Preserve factual meaning from the original source and prior drafts.",
        "- Do not number the replies.",
        "- Do not include a preamble.",
        "- Do not explain your choices.",
        "- Return only the reply text and delimiters.",
        "",
        "Follow-up instruction:",
        request.instruction or "Refine the prior drafts.",
        "",
        "Original source text:",
        truncate(source_text(thread_snapshot, request), MAX_CONTEXT_CHARS),
    ]

    if prior_variant_text:
        parts.extend([
            "",
            "Prior draft variants to refine:",
            prior_variant_text,
        ])

    return "\n".join(parts)


def latest_completed_variants(thread_snapshot: ConversationThreadSnapshot | None, current_turn_id: str | None):
    if not thread_snapshot:
        return []

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
