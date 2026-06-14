import unittest
from datetime import datetime, timezone

from app.schemas.domain import ConversationThreadRead, ConversationThreadSnapshot, DraftVariantRead, TurnRead
from app.schemas.reply_request import ReplyRequest
from app.services.prompt_builder import (
    DELIMITER,
    MEDIUM_SOURCE_CHARS,
    SHORT_SOURCE_CHARS,
    build_reply_prompt,
    build_source_depth_instruction,
    build_tone_instruction,
    classify_source_length,
)


class PromptBuilderTest(unittest.TestCase):
    def test_prompt_contains_source_tone_and_delimiter_rules(self) -> None:
        request = ReplyRequest(
            selected_text="Can you send the report today?",
            tone="friendly",
        )

        prompt = build_reply_prompt(request)

        self.assertIn("Can you send the report today?", prompt)
        self.assertIn("friendly tone", prompt)
        self.assertIn("exactly 3 replies", prompt)
        self.assertIn("exactly this delimiter", prompt)
        self.assertIn("---", prompt)
        self.assertIn("Do not number", prompt)
        self.assertIn("Do not include a preamble", prompt)
        self.assertIn("Do not explain", prompt)

    def test_refinement_prompt_contains_instruction_and_prior_variants(self) -> None:
        now = datetime.now(timezone.utc)
        request = ReplyRequest(
            selected_text="Can you send the report today?",
            tone="friendly",
            thread_id="thread-1",
            turn_id="turn-2",
            instruction="make this warmer",
            generation_mode="refinement",
        )
        snapshot = ConversationThreadSnapshot(
            thread=ConversationThreadRead(
                thread_id="thread-1",
                session_id="session-1",
                selected_text="Can you send the report today?",
                source_url="https://example.com/thread",
                source_domain="example.com",
                page_title="Inbox",
                status="active",
                created_at=now,
                updated_at=now,
            ),
            turns=[
                TurnRead(
                    turn_id="turn-1",
                    thread_id="thread-1",
                    instruction="Generate reply drafts",
                    selected_text="Can you send the report today?",
                    source_url="https://example.com/thread",
                    source_domain="example.com",
                    page_title="Inbox",
                    tone="friendly",
                    generation_status="completed",
                    created_at=now,
                    updated_at=now,
                ),
                TurnRead(
                    turn_id="turn-2",
                    thread_id="thread-1",
                    instruction="make this warmer",
                    selected_text="Can you send the report today?",
                    source_url="https://example.com/thread",
                    source_domain="example.com",
                    page_title="Inbox",
                    tone="friendly",
                    generation_status="queued",
                    created_at=now,
                    updated_at=now,
                ),
            ],
            variants=[
                DraftVariantRead(
                    variant_id="variant-1",
                    turn_id="turn-1",
                    tone="friendly",
                    length=None,
                    content="Sure, I can send the report today.",
                    rank=0,
                    status="generated",
                    is_current=False,
                    created_at=now,
                    updated_at=now,
                ),
            ],
        )

        prompt = build_reply_prompt(request, snapshot)

        self.assertIn("refines draft replies", prompt)
        self.assertIn("make this warmer", prompt)
        self.assertIn("Can you send the report today?", prompt)
        self.assertIn("Sure, I can send the report today.", prompt)
        self.assertIn("exactly 3 refined replies", prompt)

    def test_refinement_prompt_prefers_accepted_variant_over_latest_turn_fallback(self) -> None:
        now = datetime.now(timezone.utc)
        request = ReplyRequest(
            selected_text="Can you send the report today?",
            tone="friendly",
            thread_id="thread-1",
            turn_id="turn-3",
            instruction="make this clearer",
            generation_mode="refinement",
        )
        snapshot = ConversationThreadSnapshot(
            thread=ConversationThreadRead(
                thread_id="thread-1",
                session_id="session-1",
                selected_text="Can you send the report today?",
                source_url="https://example.com/thread",
                source_domain="example.com",
                page_title="Inbox",
                status="active",
                created_at=now,
                updated_at=now,
            ),
            turns=[
                TurnRead(
                    turn_id="turn-1",
                    thread_id="thread-1",
                    instruction="Generate reply drafts",
                    selected_text="Can you send the report today?",
                    source_url="https://example.com/thread",
                    source_domain="example.com",
                    page_title="Inbox",
                    tone="friendly",
                    generation_status="completed",
                    created_at=now,
                    updated_at=now,
                ),
                TurnRead(
                    turn_id="turn-2",
                    thread_id="thread-1",
                    instruction="Make it shorter",
                    selected_text="Can you send the report today?",
                    source_url="https://example.com/thread",
                    source_domain="example.com",
                    page_title="Inbox",
                    tone="friendly",
                    generation_status="completed",
                    created_at=now,
                    updated_at=now,
                ),
                TurnRead(
                    turn_id="turn-3",
                    thread_id="thread-1",
                    instruction="make this clearer",
                    selected_text="Can you send the report today?",
                    source_url="https://example.com/thread",
                    source_domain="example.com",
                    page_title="Inbox",
                    tone="friendly",
                    generation_status="queued",
                    created_at=now,
                    updated_at=now,
                ),
            ],
            variants=[
                DraftVariantRead(
                    variant_id="variant-accepted",
                    turn_id="turn-1",
                    tone="friendly",
                    length=None,
                    content="Accepted draft to refine.",
                    rank=0,
                    status="accepted",
                    is_current=True,
                    created_at=now,
                    updated_at=now,
                ),
                DraftVariantRead(
                    variant_id="variant-latest",
                    turn_id="turn-2",
                    tone="friendly",
                    length=None,
                    content="Latest generated fallback.",
                    rank=0,
                    status="generated",
                    is_current=False,
                    created_at=now,
                    updated_at=now,
                ),
            ],
        )

        prompt = build_reply_prompt(request, snapshot)

        self.assertIn("Accepted draft to refine.", prompt)
        self.assertNotIn("Latest generated fallback.", prompt)


class SourceLengthClassifierTest(unittest.TestCase):
    def test_short_classification_includes_empty_and_small_messages(self) -> None:
        self.assertEqual(classify_source_length(""), "short")
        self.assertEqual(classify_source_length("Quick question?"), "short")
        self.assertEqual(classify_source_length("a" * SHORT_SOURCE_CHARS), "short")

    def test_medium_classification_covers_a_short_email(self) -> None:
        self.assertEqual(classify_source_length("a" * (SHORT_SOURCE_CHARS + 1)), "medium")
        self.assertEqual(classify_source_length("a" * MEDIUM_SOURCE_CHARS), "medium")

    def test_long_classification_covers_multi_paragraph_email(self) -> None:
        self.assertEqual(classify_source_length("a" * (MEDIUM_SOURCE_CHARS + 1)), "long")
        self.assertEqual(classify_source_length("a" * 4000), "long")


class SourceDepthInstructionTest(unittest.TestCase):
    def test_short_source_returns_no_extra_instruction(self) -> None:
        self.assertEqual(build_source_depth_instruction("Quick question?"), "")

    def test_medium_source_asks_to_address_the_main_ask(self) -> None:
        instruction = build_source_depth_instruction("a" * 800)

        self.assertIn("main request", instruction)
        self.assertNotIn("explicit ask", instruction)
        self.assertNotIn("one-line", instruction)

    def test_long_source_asks_for_depth_and_detail_preservation(self) -> None:
        instruction = build_source_depth_instruction("a" * 4000)

        self.assertIn("explicit ask", instruction)
        self.assertIn("one-line", instruction)
        self.assertIn("Preserve important factual details", instruction)
        self.assertIn("deadlines", instruction)
        self.assertIn("2-5 short paragraphs", instruction)


class ToneInstructionTest(unittest.TestCase):
    def test_concise_with_short_source_returns_no_extra_instruction(self) -> None:
        self.assertEqual(build_tone_instruction("concise", "Quick question?"), "")

    def test_concise_with_long_source_clarifies_complete_but_compact(self) -> None:
        instruction = build_tone_instruction("concise", "a" * 4000)

        self.assertIn("compact but complete", instruction)
        self.assertIn("without adding filler", instruction)

    def test_non_concise_tones_never_receive_the_compact_instruction(self) -> None:
        self.assertEqual(build_tone_instruction("friendly", "a" * 4000), "")
        self.assertEqual(build_tone_instruction("professional", "a" * 4000), "")


class PromptBuilderLengthAwarenessTest(unittest.TestCase):
    def test_short_source_prompt_stays_minimal(self) -> None:
        request = ReplyRequest(selected_text="Can you send the report today?", tone="friendly")

        prompt = build_reply_prompt(request)

        self.assertNotIn("main request", prompt)
        self.assertNotIn("explicit ask", prompt)
        self.assertNotIn("one-line", prompt)
        self.assertIn("exactly 3 replies", prompt)
        self.assertIn("Do not number", prompt)
        self.assertIn("Do not include a preamble", prompt)
        self.assertIn("Do not invent", prompt)

    def test_medium_source_prompt_addresses_the_main_ask(self) -> None:
        request = ReplyRequest(
            selected_text=("Please share an update on the budget review and the rollout plan. " * 15).strip(),
            tone="professional",
        )

        prompt = build_reply_prompt(request)

        self.assertIn("main request", prompt)
        self.assertNotIn("explicit ask", prompt)
        self.assertNotIn("one-line", prompt)

    def test_long_source_prompt_requests_depth_and_preservation(self) -> None:
        long_source = (
            "Hi team, I have several open items to address before Friday's review. "
            "First, the budget variance report needs sign-off by noon Thursday. "
            "Second, the rollout plan timeline has slipped by two weeks and we need a recovery proposal. "
            "Third, the vendor contract renewal question came up again and legal wants our position by end of week. "
            "Please reply covering all three items, confirm the Thursday deadline, and propose a recovery plan."
        ) * 4

        request = ReplyRequest(selected_text=long_source, tone="professional")

        prompt = build_reply_prompt(request)

        self.assertIn("exactly 3 replies", prompt)
        self.assertIn(DELIMITER, prompt)
        self.assertIn("explicit ask", prompt)
        self.assertIn("deadlines", prompt)
        self.assertIn("Preserve important factual details", prompt)
        self.assertIn("one-line", prompt)
        self.assertIn("2-5 short paragraphs", prompt)
        self.assertIn("Do not invent", prompt)
        self.assertIn(long_source[:200], prompt)

    def test_concise_tone_with_long_source_clarifies_meaning(self) -> None:
        request = ReplyRequest(
            selected_text=("We have a number of follow-ups to handle in the contract review. " * 60).strip(),
            tone="concise",
        )

        prompt = build_reply_prompt(request)

        self.assertIn("compact but complete", prompt)
        self.assertIn("without adding filler", prompt)

    def test_concise_tone_with_short_source_remains_unchanged(self) -> None:
        request = ReplyRequest(selected_text="Quick question?", tone="concise")

        prompt = build_reply_prompt(request)

        self.assertNotIn("compact but complete", prompt)

    def test_long_source_is_not_truncated_in_initial_mode(self) -> None:
        long_source = "a" * 4000
        request = ReplyRequest(selected_text=long_source, tone="friendly")

        prompt = build_reply_prompt(request)

        self.assertIn(long_source, prompt)
        self.assertNotIn("aaa...", prompt)

    def test_refinement_with_long_source_keeps_depth_guidance(self) -> None:
        now = datetime.now(timezone.utc)
        long_source = (
            "We have multiple follow-ups to handle in the contract review. " * 60
        ).strip()
        request = ReplyRequest(
            selected_text=long_source,
            tone="professional",
            thread_id="thread-1",
            turn_id="turn-2",
            instruction="make this warmer",
            generation_mode="refinement",
        )
        snapshot = ConversationThreadSnapshot(
            thread=ConversationThreadRead(
                thread_id="thread-1",
                session_id="session-1",
                selected_text=long_source,
                source_url="https://example.com/thread",
                source_domain="example.com",
                page_title="Inbox",
                status="active",
                created_at=now,
                updated_at=now,
            ),
            turns=[
                TurnRead(
                    turn_id="turn-1",
                    thread_id="thread-1",
                    instruction="Generate reply drafts",
                    selected_text=long_source,
                    source_url="https://example.com/thread",
                    source_domain="example.com",
                    page_title="Inbox",
                    tone="professional",
                    generation_status="completed",
                    created_at=now,
                    updated_at=now,
                ),
                TurnRead(
                    turn_id="turn-2",
                    thread_id="thread-1",
                    instruction="make this warmer",
                    selected_text=long_source,
                    source_url="https://example.com/thread",
                    source_domain="example.com",
                    page_title="Inbox",
                    tone="professional",
                    generation_status="queued",
                    created_at=now,
                    updated_at=now,
                ),
            ],
            variants=[
                DraftVariantRead(
                    variant_id="variant-1",
                    turn_id="turn-1",
                    tone="professional",
                    length=None,
                    content="Initial draft body.",
                    rank=0,
                    status="accepted",
                    is_current=True,
                    created_at=now,
                    updated_at=now,
                ),
            ],
        )

        prompt = build_reply_prompt(request, snapshot)

        self.assertIn("Original source text:", prompt)
        self.assertIn("explicit ask", prompt)
        self.assertIn("one-line", prompt)
        self.assertIn("Initial draft body.", prompt)
        self.assertIn("make this warmer", prompt)
        self.assertIn("exactly 3 refined replies", prompt)

    def test_refinement_with_short_source_keeps_original_structure(self) -> None:
        now = datetime.now(timezone.utc)
        request = ReplyRequest(
            selected_text="Can you send the report today?",
            tone="professional",
            thread_id="thread-1",
            turn_id="turn-2",
            instruction="make this warmer",
            generation_mode="refinement",
        )
        snapshot = ConversationThreadSnapshot(
            thread=ConversationThreadRead(
                thread_id="thread-1",
                session_id="session-1",
                selected_text="Can you send the report today?",
                source_url="https://example.com/thread",
                source_domain="example.com",
                page_title="Inbox",
                status="active",
                created_at=now,
                updated_at=now,
            ),
            turns=[
                TurnRead(
                    turn_id="turn-1",
                    thread_id="thread-1",
                    instruction="Generate reply drafts",
                    selected_text="Can you send the report today?",
                    source_url="https://example.com/thread",
                    source_domain="example.com",
                    page_title="Inbox",
                    tone="professional",
                    generation_status="completed",
                    created_at=now,
                    updated_at=now,
                ),
                TurnRead(
                    turn_id="turn-2",
                    thread_id="thread-1",
                    instruction="make this warmer",
                    selected_text="Can you send the report today?",
                    source_url="https://example.com/thread",
                    source_domain="example.com",
                    page_title="Inbox",
                    tone="professional",
                    generation_status="queued",
                    created_at=now,
                    updated_at=now,
                ),
            ],
            variants=[
                DraftVariantRead(
                    variant_id="variant-1",
                    turn_id="turn-1",
                    tone="professional",
                    length=None,
                    content="Sure, I can send the report today.",
                    rank=0,
                    status="accepted",
                    is_current=True,
                    created_at=now,
                    updated_at=now,
                ),
            ],
        )

        prompt = build_reply_prompt(request, snapshot)

        self.assertNotIn("explicit ask", prompt)
        self.assertNotIn("one-line", prompt)
        self.assertNotIn("compact but complete", prompt)
        self.assertIn("Sure, I can send the report today.", prompt)
        self.assertIn("make this warmer", prompt)


if __name__ == "__main__":
    unittest.main()
