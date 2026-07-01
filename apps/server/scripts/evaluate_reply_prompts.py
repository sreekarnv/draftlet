#!/usr/bin/env python3
"""Local prompt eval harness for Draftlet reply quality.

This is intentionally not part of CI. It can render prompts deterministically
or call a local Ollama model for manual review of platform-specific behavior.
Run from apps/server:

    uv run python scripts/evaluate_reply_prompts.py --dry-run
    uv run python scripts/evaluate_reply_prompts.py --model gemma3:4b
"""

from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass
from pathlib import Path
import sys
from typing import Iterable

SERVER_ROOT = Path(__file__).resolve().parents[1]
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

from app.core.config import get_settings
from app.schemas.reply_request import ReplyRequest
from app.services.ollama_client import OllamaClientError, stream_ollama_generate
from app.services.prompt_builder import build_reply_prompt
from app.services.stream_parser import parse_reply_chunks


ExpectedTerm = str | tuple[str, ...]
TEXT_LIKE_SURFACES = {"text_message", "chat", "social_post"}
TEXT_LIKE_FORBIDDEN_TERMS = ("dear", "sincerely", "best regards")
VERIFICATION_FORBIDDEN_TERMS = ("thank you", "thanks", "confirm receipt", "dear customer")


@dataclass(frozen=True)
class ReplyPromptCase:
    name: str
    selected_text: str
    tone: str
    reply_surface: str
    reply_style: str
    expected_terms: tuple[ExpectedTerm, ...]
    forbidden_terms: tuple[str, ...] = ()


CASES: tuple[ReplyPromptCase, ...] = (
    ReplyPromptCase(
        name="formal_multi_question_email",
        selected_text=(
            "Hi Maya, can you confirm whether the Q3 launch brief is approved? "
            "Also, please send the revised pricing table by Friday and let me know who owns the customer note."
        ),
        tone="professional",
        reply_surface="email",
        reply_style="formal",
        expected_terms=("q3", "friday", "customer"),
    ),
    ReplyPromptCase(
        name="verification_test_email",
        selected_text=(
            "Subject: Notification: Account Verification Test Dear Customer, "
            "This is an automated message from [Company Name] to verify that your email notifications are properly configured."
        ),
        tone="professional",
        reply_surface="email",
        reply_style="formal",
        expected_terms=("verified", "configured"),
        forbidden_terms=("thank you for sending", "thanks for sending", "dear customer"),
    ),
    ReplyPromptCase(
        name="short_text_message",
        selected_text="Can you pick up dinner and text me when you're leaving?",
        tone="casual",
        reply_surface="text_message",
        reply_style="short",
        expected_terms=("dinner",),
        forbidden_terms=("sincerely", "best regards", "dear"),
    ),
    ReplyPromptCase(
        name="direct_chat_dm",
        selected_text="Can you check the deploy logs when you get a minute?",
        tone="casual",
        reply_surface="chat",
        reply_style="casual",
        expected_terms=("logs",),
        forbidden_terms=("sincerely", "best regards"),
    ),
    ReplyPromptCase(
        name="public_comment",
        selected_text="This PR changes the cache key. Any concerns before merge?",
        tone="professional",
        reply_surface="comment",
        reply_style="friendly",
        expected_terms=("cache", "merge"),
        forbidden_terms=("private", "confidential"),
    ),
    ReplyPromptCase(
        name="social_post_reply",
        selected_text="What did you think of the local-first AI demo?",
        tone="casual",
        reply_surface="social_post",
        reply_style="short",
        expected_terms=("demo",),
        forbidden_terms=("best regards", "sincerely"),
    ),
)


def build_request(case: ReplyPromptCase) -> ReplyRequest:
    return ReplyRequest(
        selected_text=case.selected_text,
        tone=case.tone,
        reply_surface=case.reply_surface,
        reply_style=case.reply_style,
    )


async def run_case(case: ReplyPromptCase, *, model: str, ollama_base_url: str, dry_run: bool) -> None:
    prompt = build_reply_prompt(build_request(case))
    print(f"\n## {case.name}")
    print(f"surface={case.reply_surface} style={case.reply_style} tone={case.tone}")

    if dry_run:
        print("\nPROMPT:\n")
        print(prompt)
        return

    chunks: list[str] = []
    async for chunk in stream_ollama_generate(base_url=ollama_base_url, model=model, prompt=prompt):
        chunks.append(chunk)

    replies = list(parse_reply_chunks(chunks))
    if not replies:
        replies = ["".join(chunks).strip()]

    for index, reply in enumerate(replies, start=1):
        print(f"\nReply {index}:")
        print(reply)

    failures = score_replies(replies, case)
    if failures:
        print("\nChecks: FAIL")
        for failure in failures:
            print(f"- {failure}")
    else:
        print("\nChecks: PASS")


def score_replies(replies: Iterable[str], case: ReplyPromptCase) -> list[str]:
    parsed_replies = list(replies)
    failures: list[str] = []

    if len(parsed_replies) != 3:
        failures.append(f"expected exactly 3 parsed replies, got {len(parsed_replies)}")

    forbidden_terms = case.forbidden_terms + surface_forbidden_terms(case)

    for index, reply in enumerate(parsed_replies, start=1):
        normalized_reply = reply.lower()

        for term in case.expected_terms:
            if not expected_term_matches(normalized_reply, term):
                failures.append(f"reply {index} missing expected term: {format_expected_term(term)}")

        for term in forbidden_terms:
            if term.lower() in normalized_reply:
                failures.append(f"reply {index} included forbidden term: {term}")

    return failures


def expected_term_matches(reply: str, term: ExpectedTerm) -> bool:
    if isinstance(term, tuple):
        return any(option.lower() in reply for option in term)

    return term.lower() in reply


def format_expected_term(term: ExpectedTerm) -> str:
    if isinstance(term, tuple):
        return " or ".join(term)

    return term


def surface_forbidden_terms(case: ReplyPromptCase) -> tuple[str, ...]:
    forbidden_terms: list[str] = []

    if case.reply_surface in TEXT_LIKE_SURFACES:
        forbidden_terms.extend(TEXT_LIKE_FORBIDDEN_TERMS)

    if is_verification_or_test_case(case):
        forbidden_terms.extend(VERIFICATION_FORBIDDEN_TERMS)

    return tuple(forbidden_terms)


def is_verification_or_test_case(case: ReplyPromptCase) -> bool:
    haystack = f"{case.name} {case.selected_text}".lower()
    return any(term in haystack for term in ("verification", "verify", "test", "automated", "notification"))


async def main() -> int:
    settings = get_settings()
    parser = argparse.ArgumentParser(description="Evaluate Draftlet reply prompts against local cases.")
    parser.add_argument("--case", choices=[case.name for case in CASES], help="Run one case only.")
    parser.add_argument("--model", default=settings.default_model, help="Ollama model to use when not in dry-run mode.")
    parser.add_argument("--ollama-base-url", default=settings.ollama_base_url, help="Ollama base URL.")
    parser.add_argument("--dry-run", action="store_true", help="Render prompts only; do not call Ollama.")
    args = parser.parse_args()

    cases = [case for case in CASES if args.case in (None, case.name)]

    try:
        for case in cases:
            await run_case(case, model=args.model, ollama_base_url=args.ollama_base_url, dry_run=args.dry_run)
    except OllamaClientError as error:
        print(f"Ollama error: {error}")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
