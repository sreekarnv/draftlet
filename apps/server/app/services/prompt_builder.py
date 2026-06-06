from app.schemas.reply_request import ReplyRequest


DELIMITER = "---"


def build_reply_prompt(request: ReplyRequest) -> str:
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
