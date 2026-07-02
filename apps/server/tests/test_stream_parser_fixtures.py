"""Regression fixtures for measuring parser behavior on real model output.

Capture procedure:
1. From apps/server, run the prompt eval harness manually against gemma3:4b:
   uv run python scripts/evaluate_reply_prompts.py --model gemma3:4b --case <case_name>
2. Paste the raw model output into a JSON fixture under tests/fixtures/replies/.
3. Set expected_parsed to the replies ReplyStreamParser should produce from that raw output.
4. Set expected_required_terms and expected_forbidden_terms for content checks.
5. If a real gemma3:4b run exposes a parser gap, name the fixture
   known_failure_<description>.json and document the current output in expected_parsed.
   The fixture is xfailed here so it records evidence without breaking offline CI.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.services.stream_parser import ReplyStreamParser


FIXTURE_DIR = Path(__file__).parent / "fixtures" / "replies"


def load_fixtures() -> list[dict[str, Any]]:
    fixtures: list[dict[str, Any]] = []

    for path in sorted(FIXTURE_DIR.glob("*.json")):
        with path.open() as file:
            fixture = json.load(file)
        fixture["_path"] = path
        fixtures.append(fixture)

    return fixtures


def parse_raw_output(raw_model_output: str) -> list[str]:
    parser = ReplyStreamParser()
    replies = parser.feed(raw_model_output)
    replies.extend(parser.finish())
    return replies


@pytest.mark.parametrize("fixture", load_fixtures(), ids=lambda fixture: fixture["name"])
def test_stream_parser_matches_captured_gemma3_output(fixture: dict[str, Any]) -> None:
    if fixture["name"].startswith("known_failure_"):
        pytest.xfail("documents a known parser gap from captured model output")

    parsed = parse_raw_output(fixture["raw_model_output"])

    assert parsed == fixture["expected_parsed"]


@pytest.mark.parametrize("fixture", load_fixtures(), ids=lambda fixture: fixture["name"])
def test_stream_parser_fixture_replies_meet_content_checks(fixture: dict[str, Any]) -> None:
    if fixture["name"].startswith("known_failure_"):
        pytest.xfail("documents a known parser gap from captured model output")

    parsed = parse_raw_output(fixture["raw_model_output"])

    for reply in parsed:
        normalized_reply = reply.lower()
        for term in fixture["expected_required_terms"]:
            assert term.lower() in normalized_reply, f"{fixture['name']} missing required term: {term}"
        for term in fixture["expected_forbidden_terms"]:
            assert term.lower() not in normalized_reply, f"{fixture['name']} included forbidden term: {term}"
