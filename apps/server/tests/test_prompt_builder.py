import unittest

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


if __name__ == "__main__":
    unittest.main()
