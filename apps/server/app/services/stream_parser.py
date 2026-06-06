from collections.abc import Iterable, Iterator
import re


DELIMITER = "---"
MAX_REPLIES = 3

_PREAMBLE_PATTERN = re.compile(
    r"^\s*(?:sure[,.]?\s*)?"
    r"here\s+(?:are|is)\s+(?:three|3)\s+"
    r"(?:draft\s+)?repl(?:y|ies)\s*:?\s*",
    re.IGNORECASE,
)
_NUMBERING_PATTERN = re.compile(r"^\s*(?:\d+[\).]|[-*])\s+")


class ReplyStreamParser:
    def __init__(self, max_replies: int = MAX_REPLIES) -> None:
        self._buffer = ""
        self._count = 0
        self._max_replies = max_replies

    def feed(self, chunk: str) -> list[str]:
        if self._count >= self._max_replies:
            return []

        self._buffer += chunk
        replies: list[str] = []

        while DELIMITER in self._buffer and self._count < self._max_replies:
            candidate, self._buffer = self._buffer.split(DELIMITER, 1)
            reply = clean_reply(candidate, is_first=self._count == 0)

            if not reply:
                continue

            replies.append(reply)
            self._count += 1

        return replies

    def finish(self) -> list[str]:
        if self._count >= self._max_replies:
            self._buffer = ""
            return []

        reply = clean_reply(self._buffer, is_first=self._count == 0)
        self._buffer = ""

        if not reply:
            return []

        self._count += 1
        return [reply]


def parse_reply_chunks(chunks: Iterable[str]) -> Iterator[str]:
    parser = ReplyStreamParser()

    for chunk in chunks:
        yield from parser.feed(chunk)

    yield from parser.finish()


def clean_reply(value: str, *, is_first: bool = False) -> str:
    reply = value.strip()

    if is_first:
        reply = _PREAMBLE_PATTERN.sub("", reply).strip()

    reply = _NUMBERING_PATTERN.sub("", reply).strip()
    return reply
