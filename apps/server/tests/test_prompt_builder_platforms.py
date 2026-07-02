import unittest

from app.schemas.reply_request import ReplyRequest
from app.services.prompt_builder import (
    build_platform_instruction,
    build_reply_prompt,
    build_transactional_context_instruction,
)


GMAIL_BULLET = "- Reply platform is Gmail."
WHATSAPP_BULLET = "- Reply platform is WhatsApp."


class PlatformInstructionHelperTest(unittest.TestCase):
    def test_none_returns_no_instruction(self) -> None:
        self.assertEqual(build_platform_instruction(None, "anything"), "")

    def test_unknown_returns_no_instruction(self) -> None:
        self.assertEqual(build_platform_instruction("unknown", "anything"), "")

    def test_unrecognized_value_returns_no_instruction(self) -> None:
        self.assertEqual(build_platform_instruction("slack", "anything"), "")

    def test_gmail_returns_gmail_bullet(self) -> None:
        instruction = build_platform_instruction("gmail", "anything")

        self.assertIn("Reply platform is Gmail", instruction)
        self.assertIn("greetings and sign-offs", instruction)
        self.assertNotIn("WhatsApp", instruction)

    def test_whatsapp_returns_whatsapp_bullet(self) -> None:
        instruction = build_platform_instruction("whatsapp", "anything")

        self.assertIn("Reply platform is WhatsApp", instruction)
        self.assertIn("Do not include greeting or sign-off", instruction)
        self.assertNotIn("Gmail", instruction)


class PlatformPromptRegressionTest(unittest.TestCase):
    def test_no_platform_id_omits_platform_bullets(self) -> None:
        request = ReplyRequest(
            selected_text="Can you send the report today?",
            tone="friendly",
        )

        prompt = build_reply_prompt(request)

        self.assertNotIn(GMAIL_BULLET, prompt)
        self.assertNotIn(WHATSAPP_BULLET, prompt)
        self.assertNotIn("Reply platform is", prompt)

    def test_gmail_platform_id_adds_gmail_bullet_only(self) -> None:
        request = ReplyRequest(
            selected_text="Can you send the report today?",
            tone="friendly",
            platform_id="gmail",
        )

        prompt = build_reply_prompt(request)

        self.assertIn(GMAIL_BULLET, prompt)
        self.assertNotIn(WHATSAPP_BULLET, prompt)

    def test_whatsapp_platform_id_adds_whatsapp_bullet_only(self) -> None:
        request = ReplyRequest(
            selected_text="Can you pick up dinner?",
            tone="casual",
            platform_id="whatsapp",
        )

        prompt = build_reply_prompt(request)

        self.assertIn(WHATSAPP_BULLET, prompt)
        self.assertNotIn(GMAIL_BULLET, prompt)

    def test_unknown_platform_id_omits_platform_bullets(self) -> None:
        request = ReplyRequest(
            selected_text="Can you send the report today?",
            tone="friendly",
            platform_id="unknown",
        )

        prompt = build_reply_prompt(request)

        self.assertNotIn(GMAIL_BULLET, prompt)
        self.assertNotIn(WHATSAPP_BULLET, prompt)
        self.assertNotIn("Reply platform is", prompt)

    def test_gmail_platform_id_on_verification_email_keeps_transactional_rule(self) -> None:
        request = ReplyRequest(
            selected_text=(
                "Subject: Notification: Account Verification Test Dear Customer, "
                "This is an automated message from [Company Name] to verify that your email notifications are properly configured."
            ),
            tone="professional",
            reply_surface="email",
            reply_style="formal",
            platform_id="gmail",
        )

        prompt = build_reply_prompt(request)

        self.assertIn(GMAIL_BULLET, prompt)
        self.assertIn("verification/test message", prompt)
        self.assertIn("do not thank the sender for writing", prompt)
        self.assertIn("acknowledge the verified status", prompt)
        self.assertEqual(
            build_transactional_context_instruction(request.selected_text),
            "- If the source is an automated, transactional, notification, or verification/test message, write a minimal status-style reply from the user's perspective; acknowledge the verified status or requested action directly; when the source mentions verify, verification, configured, or notifications, use those exact words in every reply; do not use a greeting, do not thank the sender for writing, say thanks, confirm receipt, ask whether further action is required, or repeat customer-service greetings.",
        )


if __name__ == "__main__":
    unittest.main()
