from typing import Any


def email_metadata(
    *,
    provider: str,
    provider_thread_id: str | None,
    provider_message_id: str,
    subject: str,
    sender: str,
    to: list[str],
    cc: list[str],
    bcc: list[str],
    url: str | None,
    body_format: str,
    extra: dict[str, Any] | None = None,
) -> dict[str, object]:
    metadata: dict[str, object] = {
        "provider": provider,
        "provider_thread_id": provider_thread_id,
        "provider_message_id": provider_message_id,
        "subject": subject,
        "from": sender,
        "to": to,
        "cc": cc,
        "bcc": bcc,
        "body_format": body_format,
    }
    if url:
        metadata["url"] = url
    if extra:
        metadata.update(extra)
    return metadata
