import unittest
from datetime import datetime, timedelta, timezone

from app.schemas.domain import ConversationThreadRead, ConversationThreadSnapshot, DraftVariantRead, TurnRead
from app.schemas.reply_request import ReplyRequest
from app.services.prompt_builder import (
    DELIMITER,
    MEDIUM_SOURCE_CHARS,
    SHORT_SOURCE_CHARS,
    build_reply_prompt,
    compact_text,
    build_source_coverage_instruction,
    build_source_depth_instruction,
    build_transactional_context_instruction,
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


class SourceCoverageInstructionTest(unittest.TestCase):
    def test_single_question_returns_no_extra_coverage_instruction(self) -> None:
        self.assertEqual(build_source_coverage_instruction("Can you send the report today?"), "")

    def test_short_multi_question_source_requests_direct_coverage(self) -> None:
        instruction = build_source_coverage_instruction("Can you send the report? Also, can you confirm the deadline?")

        self.assertIn("multiple questions or asks", instruction)
        self.assertIn("answer each material question", instruction)
        self.assertIn("generic acknowledgement", instruction)

    def test_short_multi_ask_source_requests_direct_coverage(self) -> None:
        instruction = build_source_coverage_instruction("Please review the copy and confirm the launch date.")

        self.assertIn("multiple questions or asks", instruction)


class TransactionalContextInstructionTest(unittest.TestCase):
    def test_regular_message_returns_no_transactional_instruction(self) -> None:
        self.assertEqual(build_transactional_context_instruction("Can you send the report today?"), "")

    def test_verification_test_email_gets_minimal_acknowledgement_guidance(self) -> None:
        instruction = build_transactional_context_instruction(
            "Subject: Notification: Account Verification Test Dear Customer, this is an automated message to verify notifications are properly configured."
        )

        self.assertIn("automated, transactional, notification, or verification/test message", instruction)
        self.assertIn("do not thank the sender for writing", instruction)
        self.assertIn("acknowledge the verified status", instruction)


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


class ReplySurfacePromptTest(unittest.TestCase):
    def test_email_surface_uses_email_structure_guidance(self) -> None:
        request = ReplyRequest(
            selected_text="Can you confirm the contract review by Friday?",
            tone="professional",
            reply_surface="email",
            reply_style="formal",
        )

        prompt = build_reply_prompt(request)

        self.assertIn("Reply as email", prompt)
        self.assertIn("greeting or sign-off", prompt)
        self.assertIn("formal style", prompt)

    def test_text_message_surface_avoids_email_conventions(self) -> None:
        request = ReplyRequest(
            selected_text="Are you still free for lunch?",
            tone="casual",
            reply_surface="text_message",
            reply_style="casual",
        )

        prompt = build_reply_prompt(request)

        self.assertIn("Reply as a text message", prompt)
        self.assertIn("do not include email greetings", prompt)
        self.assertIn("casual style", prompt)

    def test_unknown_surface_keeps_balanced_fallback(self) -> None:
        request = ReplyRequest(
            selected_text="Can you share the update?",
            tone="friendly",
            reply_surface="made_up_surface",
        )

        prompt = build_reply_prompt(request)

        self.assertIn("target platform is unknown", prompt)

    def test_formal_email_multi_question_prompt_requires_complete_email_reply(self) -> None:
        request = ReplyRequest(
            selected_text=(
                "Hi Maya, can you confirm whether the Q3 launch brief is approved? "
                "Also, please send the revised pricing table by Friday and let me know who owns the customer note."
            ),
            tone="professional",
            reply_surface="email",
            reply_style="formal",
        )

        prompt = build_reply_prompt(request)

        self.assertIn("Reply as email", prompt)
        self.assertIn("formal style", prompt)
        self.assertIn("answer each material question", prompt)
        self.assertIn("Do not invent facts", prompt)
        self.assertIn("Q3 launch brief", prompt)
        self.assertIn("revised pricing table by Friday", prompt)

    def test_verification_email_prompt_avoids_sender_thanks(self) -> None:
        request = ReplyRequest(
            selected_text=(
                "Subject: Notification: Account Verification Test Dear Customer, "
                "This is an automated message from [Company Name] to verify that your email notifications are properly configured."
            ),
            tone="professional",
            reply_surface="email",
            reply_style="formal",
        )

        prompt = build_reply_prompt(request)

        self.assertIn("verification/test message", prompt)
        self.assertIn("do not thank the sender for writing", prompt)
        self.assertIn("acknowledge the verified status", prompt)
        self.assertIn("Reply as email", prompt)

    def test_friendly_email_prompt_allows_warmth_but_preserves_email_conventions(self) -> None:
        request = ReplyRequest(
            selected_text="Thanks for jumping in. Could you send the agenda before our Monday sync?",
            tone="friendly",
            reply_surface="email",
            reply_style="friendly",
        )

        prompt = build_reply_prompt(request)

        self.assertIn("Reply as email", prompt)
        self.assertIn("friendly style", prompt)
        self.assertIn("greeting or sign-off", prompt)
        self.assertNotIn("do not include email greetings", prompt)

    def test_text_message_prompt_stays_short_and_avoids_email_structure(self) -> None:
        request = ReplyRequest(
            selected_text="Can you pick up dinner and text me when you're leaving?",
            tone="casual",
            reply_surface="text_message",
            reply_style="short",
        )

        prompt = build_reply_prompt(request)

        self.assertIn("Reply as a text message", prompt)
        self.assertIn("do not include email greetings", prompt)
        self.assertIn("1-3 concise sentences", prompt)

    def test_chat_prompt_is_direct_without_email_signoff(self) -> None:
        request = ReplyRequest(
            selected_text="Can you check the deploy logs when you get a minute?",
            tone="casual",
            reply_surface="chat",
            reply_style="casual",
        )

        prompt = build_reply_prompt(request)

        self.assertIn("Reply as a chat or DM", prompt)
        self.assertIn("no email-style sign-off", prompt)
        self.assertIn("casual style", prompt)

    def test_comment_prompt_assumes_public_context(self) -> None:
        request = ReplyRequest(
            selected_text="This PR changes the cache key. Any concerns before merge?",
            tone="professional",
            reply_surface="comment",
            reply_style="friendly",
        )

        prompt = build_reply_prompt(request)

        self.assertIn("public or semi-public comment", prompt)
        self.assertIn("avoid oversharing private details", prompt)
        self.assertIn("friendly style", prompt)

    def test_social_post_prompt_is_feed_appropriate(self) -> None:
        request = ReplyRequest(
            selected_text="What did you think of the local-first AI demo?",
            tone="casual",
            reply_surface="social_post",
            reply_style="short",
        )

        prompt = build_reply_prompt(request)

        self.assertIn("Reply as a social post", prompt)
        self.assertIn("platform-appropriate", prompt)
        self.assertIn("1-3 concise sentences", prompt)

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

        self.assertIn("Original source context:", prompt)
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


class ContextCompactionTest(unittest.TestCase):
    def test_compaction_preserves_questions_names_dates_commitments_and_marks_omission(self) -> None:
        long_source = " ".join(
            ["Older low-priority background." for _index in range(160)]
            + [
                "Can Maya Chen review the launch copy by Thursday?",
                "Please confirm that Jordan will send the budget numbers tomorrow.",
            ]
            + ["Additional low-priority background." for _index in range(160)]
        )

        context = compact_text(long_source, 1400)

        self.assertTrue(context.omitted)
        self.assertIn("Context omitted", context.text)
        self.assertIn("Can Maya Chen review the launch copy by Thursday?", context.text)
        self.assertIn("Jordan will send the budget numbers tomorrow", context.text)

    def test_refinement_prompt_includes_recent_thread_context_before_older_context(self) -> None:
        now = datetime.now(timezone.utc)
        request = ReplyRequest(
            selected_text="Current selected text asks whether we can commit to the new launch date.",
            tone="professional",
            thread_id="thread-1",
            turn_id="turn-3",
            instruction="answer all their questions",
            generation_mode="refinement",
        )
        snapshot = ConversationThreadSnapshot(
            thread=ConversationThreadRead(
                thread_id="thread-1",
                session_id="session-1",
                selected_text="Original selected text.",
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
                    selected_text="Older context asks for the March 2 budget note.",
                    source_url="https://example.com/thread",
                    source_domain="example.com",
                    page_title="Inbox",
                    tone="professional",
                    generation_status="completed",
                    created_at=now - timedelta(hours=2),
                    updated_at=now - timedelta(hours=2),
                ),
                TurnRead(
                    turn_id="turn-2",
                    thread_id="thread-1",
                    instruction="Make it clearer",
                    selected_text="Recent context asks whether Priya can join the Friday review.",
                    source_url="https://example.com/thread",
                    source_domain="example.com",
                    page_title="Inbox",
                    tone="professional",
                    generation_status="completed",
                    created_at=now - timedelta(hours=1),
                    updated_at=now - timedelta(hours=1),
                ),
                TurnRead(
                    turn_id="turn-3",
                    thread_id="thread-1",
                    instruction="answer all their questions",
                    selected_text="Current selected text asks whether we can commit to the new launch date.",
                    source_url="https://example.com/thread",
                    source_domain="example.com",
                    page_title="Inbox",
                    tone="professional",
                    generation_status="queued",
                    created_at=now,
                    updated_at=now,
                ),
            ],
            variants=[],
        )

        prompt = build_reply_prompt(request, snapshot)

        self.assertIn("Current selected text", prompt)
        self.assertIn("Recent thread context before the selected text", prompt)
        self.assertLess(prompt.index("Recent context asks"), prompt.index("Older context asks"))

    def test_custom_tone_prompt_uses_custom_instruction(self) -> None:
        request = ReplyRequest(
            selected_text="Please reply to Sam about the Friday demo.",
            tone="custom",
            custom_tone_instruction="Sound optimistic but avoid exclamation points.",
        )

        prompt = build_reply_prompt(request)

        self.assertIn("Custom tone instruction", prompt)
        self.assertIn("Sound optimistic but avoid exclamation points.", prompt)


if __name__ == "__main__":
    unittest.main()
