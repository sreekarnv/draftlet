#!/usr/bin/env python3
"""Measure current stream parser reliability against a local Ollama model.

This is a local-only measurement tool, not a CI gate. It runs the existing
reply prompt eval cases against a real model, parses the raw stream with the
current ReplyStreamParser, scores the parsed replies, and prints a baseline
success rate that can be compared across runs.

Run from apps/server:
    uv run python scripts/measure_parser_reliability.py --model gemma3:4b --cases 5
"""

from __future__ import annotations

import argparse
import asyncio
from collections import Counter
from pathlib import Path
import re
import sys

SERVER_ROOT = Path(__file__).resolve().parents[1]
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

from app.core.config import get_settings
from app.services.ollama_client import OllamaClientError, stream_ollama_generate
from app.services.prompt_builder import build_reply_prompt
from app.services.stream_parser import parse_reply_chunks
from scripts.evaluate_reply_prompts import CASES, ReplyPromptCase, build_request, score_replies


_PREAMBLE_RE = re.compile(r"^\s*(?:sure[,.]?\s*)?here\s+(?:are|is)\s+(?:three|3)\s+", re.IGNORECASE)
_NUMBERING_RE = re.compile(r"^\s*(?:\d+[).]|[-*])\s+")


async def run_case(case: ReplyPromptCase, *, model: str, ollama_base_url: str) -> tuple[list[str], str, list[str]]:
    prompt = build_reply_prompt(build_request(case))
    chunks: list[str] = []

    async for chunk in stream_ollama_generate(base_url=ollama_base_url, model=model, prompt=prompt):
        chunks.append(chunk)

    raw_output = "".join(chunks)
    replies = list(parse_reply_chunks(chunks))
    failures = score_replies(replies, case)
    failures.extend(classify_parser_output(raw_output, replies))
    return replies, raw_output, failures


def classify_parser_output(raw_output: str, replies: list[str]) -> list[str]:
    failures: list[str] = []

    if not replies:
        failures.append("parser:no_replies")
        return failures

    if len(replies) != 3:
        failures.append("parser:reply_count")

    if _PREAMBLE_RE.match(replies[0]):
        failures.append("parser:preamble")

    if any(_NUMBERING_RE.match(reply) for reply in replies):
        failures.append("parser:numbering")

    if "---" not in raw_output and len(replies) == 1:
        failures.append("parser:missing_delimiters")

    return failures


def failure_bucket(failure: str) -> str:
    if failure.startswith("parser:"):
        return failure.removeprefix("parser:")
    if "missing expected term" in failure:
        return "missing_terms"
    if "included forbidden term" in failure:
        return "forbidden_terms"
    if "expected exactly 3 parsed replies" in failure:
        return "split_coverage"
    return "other"


async def main() -> int:
    settings = get_settings()
    parser = argparse.ArgumentParser(description="Measure Draftlet parser reliability against local Ollama output.")
    parser.add_argument("--model", default="gemma3:4b", help="Ollama model to measure.")
    parser.add_argument("--ollama-base-url", default=settings.ollama_base_url, help="Ollama base URL.")
    parser.add_argument("--cases", type=int, default=len(CASES), help="Number of eval cases to run.")
    parser.add_argument("--case", choices=[case.name for case in CASES], help="Run one case only.")
    args = parser.parse_args()

    cases = [case for case in CASES if args.case in (None, case.name)][: args.cases]
    success_count = 0
    failures_by_case: dict[str, list[str]] = {}
    breakdown: Counter[str] = Counter()

    try:
        for case in cases:
            replies, _raw_output, failures = await run_case(case, model=args.model, ollama_base_url=args.ollama_base_url)
            if failures:
                failures_by_case[case.name] = failures
                breakdown.update(failure_bucket(failure) for failure in failures)
                status = "FAIL"
            else:
                success_count += 1
                status = "PASS"

            print(f"{status} {case.name}: parsed {len(replies)} replies")
    except OllamaClientError as error:
        print(f"Ollama error: {error}")
        return 1

    total = len(cases)
    failure_count = total - success_count
    success_rate = (success_count / total * 100) if total else 0.0

    print("\nParser reliability baseline")
    print(f"model: {args.model}")
    print(f"cases: {total}")
    print(f"success: {success_count}")
    print(f"failure: {failure_count}")
    print(f"success_rate: {success_rate:.1f}%")

    if breakdown:
        print("\nFailure breakdown")
        for bucket, count in breakdown.most_common():
            print(f"{bucket}: {count}")

    if failures_by_case:
        print("\nFailures by case")
        for case_name, failures in failures_by_case.items():
            print(f"{case_name}:")
            for failure in failures:
                print(f"  - {failure}")

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
