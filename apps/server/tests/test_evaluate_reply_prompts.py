import unittest

from scripts.evaluate_reply_prompts import ReplyPromptCase, score_replies


class ReplyPromptEvalScorerTest(unittest.TestCase):
    def test_score_replies_fails_split_coverage_outputs(self) -> None:
        case = ReplyPromptCase(
            name="formal_multi_question_email",
            selected_text=(
                "Hi Maya, can you confirm whether the Q3 launch brief is approved? "
                "Also, please send the revised pricing table by Friday and let me know who owns the customer note."
            ),
            tone="professional",
            reply_surface="email",
            reply_style="formal",
            expected_terms=("q3", "friday", "customer"),
        )
        replies = [
            "I can confirm the Q3 launch brief is approved.",
            "I will send the revised pricing table by Friday.",
            "Maya owns the customer note.",
        ]

        failures = score_replies(replies, case)

        self.assertIn("reply 1 missing expected term: friday", failures)
        self.assertIn("reply 1 missing expected term: customer", failures)
        self.assertIn("reply 2 missing expected term: q3", failures)
        self.assertIn("reply 3 missing expected term: friday", failures)

    def test_score_replies_requires_exactly_three_replies(self) -> None:
        case = ReplyPromptCase(
            name="short_text_message",
            selected_text="Can you pick up dinner and text me when you're leaving?",
            tone="casual",
            reply_surface="text_message",
            reply_style="short",
            expected_terms=("dinner",),
        )

        failures = score_replies(["I can pick up dinner."], case)

        self.assertIn("expected exactly 3 parsed replies, got 1", failures)

    def test_score_replies_applies_surface_forbidden_terms_to_every_reply(self) -> None:
        case = ReplyPromptCase(
            name="direct_chat_dm",
            selected_text="Can you check the deploy logs when you get a minute?",
            tone="casual",
            reply_surface="chat",
            reply_style="casual",
            expected_terms=("logs",),
        )
        replies = [
            "I can check the logs now.",
            "Dear Sam, I can check the logs now.",
            "I can check the logs now. Best regards, Maya",
        ]

        failures = score_replies(replies, case)

        self.assertIn("reply 2 included forbidden term: dear", failures)
        self.assertIn("reply 3 included forbidden term: best regards", failures)

    def test_score_replies_applies_verification_forbidden_terms_to_every_reply(self) -> None:
        case = ReplyPromptCase(
            name="verification_test_email",
            selected_text="Subject: Notification: Account Verification Test Dear Customer, notifications are configured.",
            tone="professional",
            reply_surface="email",
            reply_style="formal",
            expected_terms=("configured",),
        )
        replies = [
            "The notifications are configured.",
            "Thanks, the notifications are configured.",
            "I confirm receipt and the notifications are configured.",
        ]

        failures = score_replies(replies, case)

        self.assertIn("reply 2 included forbidden term: thanks", failures)
        self.assertIn("reply 3 included forbidden term: confirm receipt", failures)

    def test_score_replies_allows_explicit_expected_alternatives(self) -> None:
        case = ReplyPromptCase(
            name="alternative_terms",
            selected_text="Is the account verified?",
            tone="professional",
            reply_surface="email",
            reply_style="short",
            expected_terms=(("verified", "configured"),),
        )
        replies = [
            "The account is verified.",
            "The account is configured.",
            "The account is verified and ready.",
        ]

        self.assertEqual(score_replies(replies, case), [])


if __name__ == "__main__":
    unittest.main()
