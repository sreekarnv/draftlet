import enum


class ConnectorKind(str, enum.Enum):
    GMAIL = "gmail"
    TELEGRAM = "telegram"


class CaptureStatus(str, enum.Enum):
    CAPTURED = "captured"
