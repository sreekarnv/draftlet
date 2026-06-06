import unittest

from app.services.stream_parser import ReplyStreamParser, parse_reply_chunks


class StreamParserTest(unittest.TestCase):
    def test_yields_completed_replies_incrementally(self) -> None:
        parser = ReplyStreamParser()

        self.assertEqual(parser.feed("First reply"), [])
        self.assertEqual(parser.feed("\n---\nSecond"), ["First reply"])
        self.assertEqual(parser.feed(" reply\n---\nThird"), ["Second reply"])
        self.assertEqual(parser.finish(), ["Third"])

    def test_strips_common_preamble_from_first_reply(self) -> None:
        replies = list(
            parse_reply_chunks(
                [
                    "Here are three replies:\nFirst\n---\n",
                    "Second\n---\nThird",
                ]
            )
        )

        self.assertEqual(replies, ["First", "Second", "Third"])

    def test_handles_fewer_than_three_replies(self) -> None:
        replies = list(parse_reply_chunks(["Only one reply"]))

        self.assertEqual(replies, ["Only one reply"])

    def test_ignores_empty_segments_and_extra_replies(self) -> None:
        replies = list(parse_reply_chunks(["---\n1. First\n---\n2. Second\n---\n3. Third\n---\nFourth"]))

        self.assertEqual(replies, ["First", "Second", "Third"])


if __name__ == "__main__":
    unittest.main()
