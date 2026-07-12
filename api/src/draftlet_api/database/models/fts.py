from sqlalchemy import Column, MetaData, String, Table, Text

metadata = MetaData()

conversations_fts = Table(
    "conversations_fts",
    metadata,
    Column("id", String(32), nullable=False),
    Column("title", String(500), nullable=False),
    Column("contact", String(500), nullable=False),
    Column("latest_message", Text, nullable=False),
)

drafts_fts = Table(
    "drafts_fts",
    metadata,
    Column("id", String(32), nullable=False),
    Column("title", String(500), nullable=False),
    Column("text", Text, nullable=False),
    Column("instruction", Text, nullable=False),
)
