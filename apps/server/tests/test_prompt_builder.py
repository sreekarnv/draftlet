import unittest
from datetime import datetime, timezone

from app.schemas.domain import ConversationThreadRead, ConversationThreadSnapshot, DraftVariantRead, TurnRead
from app.schemas.reply_request import ReplyRequest
from app.services.prompt_builder import build_reply_prompt


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
                    legacy_reply_id=1,
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
                    legacy_reply_id=1,
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
                    legacy_reply_id=2,
                    created_at=now,
                    updated_at=now,
                ),
            ],
        )

        prompt = build_reply_prompt(request, snapshot)

        self.assertIn("Accepted draft to refine.", prompt)
        self.assertNotIn("Latest generated fallback.", prompt)


if __name__ == "__main__":
    unittest.main()
