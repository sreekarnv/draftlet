from app.api.replies import format_sse_event
from app.main import app
from app.schemas.reply_event import ReplyEvent


def test_formats_domain_variant_sse_without_legacy_reply_id() -> None:
    event = ReplyEvent(
        reply="Domain draft",
        variant_id="variant-1",
        turn_id="turn-1",
        thread_id="thread-1",
    )

    formatted = format_sse_event(event)

    assert formatted.startswith("event: draft_variant\n")
    assert "reply_id" not in formatted
    assert "id:" not in formatted
    assert "variant-1" in formatted


def test_legacy_history_route_is_not_registered() -> None:
    assert not any(route.path == "/history" and "GET" in route.methods for route in app.routes if hasattr(route, "methods"))
    assert any(route.path == "/domain/history" and "GET" in route.methods for route in app.routes if hasattr(route, "methods"))
