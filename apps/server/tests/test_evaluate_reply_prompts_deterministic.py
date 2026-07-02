from __future__ import annotations

import asyncio
import os

import pytest

from app.core.config import get_settings
from app.services.ollama_client import stream_ollama_generate
from app.services.stream_parser import parse_reply_chunks
from scripts.evaluate_reply_prompts import CASES, ReplyPromptCase, build_request, score_replies
from app.services.prompt_builder import build_reply_prompt


def deterministic_passing_replies(case: ReplyPromptCase) -> list[str]:
    required_terms = [term[0] if isinstance(term, tuple) else term for term in case.expected_terms]
    coverage = ", ".join(required_terms)
    return [
        f"I can respond with the needed details about {coverage}.",
        f"This reply covers {coverage} clearly.",
        f"I will make sure the response includes {coverage}.",
    ]


@pytest.mark.parametrize("case", CASES, ids=lambda case: case.name)
def test_offline_prompt_eval_cases_score_without_failures(case: ReplyPromptCase) -> None:
    failures = score_replies(deterministic_passing_replies(case), case)

    assert failures == []


@pytest.mark.skipif(
    not os.getenv("DRAFTLET_OLLAMA_SMOKE"),
    reason="set DRAFTLET_OLLAMA_SMOKE=1 to run against real Ollama",
)
def test_ollama_smoke_formal_multi_question_email_scores_without_failures() -> None:
    case = next(case for case in CASES if case.name == "formal_multi_question_email")

    async def run_smoke() -> list[str]:
        settings = get_settings()
        prompt = build_reply_prompt(build_request(case))
        chunks: list[str] = []
        async for chunk in stream_ollama_generate(
            base_url=settings.ollama_base_url,
            model="gemma3:4b",
            prompt=prompt,
        ):
            chunks.append(chunk)
        return list(parse_reply_chunks(chunks))

    replies = asyncio.run(run_smoke())

    assert score_replies(replies, case) == []
