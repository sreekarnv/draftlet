from draftlet_api.connectors.email.metadata import email_metadata
from draftlet_api.connectors.email.models import EmailCapture
from draftlet_api.core.enums import ConnectorKind
from draftlet_api.dtos.capture import CaptureCreate


def capture_from_email(email: EmailCapture, connector_kind: ConnectorKind) -> CaptureCreate:
    recipients = [*email.to, *email.cc, *email.bcc]
    participants = [email.sender, *recipients]
    external_thread_id = email.provider_thread_id or email.provider_message_id
    metadata = email_metadata(
        provider=email.provider,
        provider_thread_id=email.provider_thread_id,
        provider_message_id=email.provider_message_id,
        subject=email.subject,
        sender=email.sender,
        to=email.to,
        cc=email.cc,
        bcc=email.bcc,
        url=email.url,
        body_format=email.body_format,
        extra=email.metadata,
    )

    return CaptureCreate(
        connector_kind=connector_kind,
        source_message_id=email.provider_message_id,
        external_thread_id=external_thread_id,
        external_message_id=email.provider_message_id,
        reply_to_external_message_id=email.reply_to_provider_message_id,
        metadata=metadata,
        title=email.subject,
        contact=email.sender,
        participants=", ".join(dict.fromkeys(participants)),
        body=email.body,
        author=email.sender,
        timestamp=email.timestamp,
    )
