from sqlalchemy.ext.asyncio import AsyncSession

from draftlet_api.core.errors import NotFoundError
from draftlet_api.database.models import Draft
from draftlet_api.dtos.draft import DraftRead
from draftlet_api.dtos.generation import GenerationCreate
from draftlet_api.repositories.conversation_repository import ConversationRepository
from draftlet_api.repositories.draft_repository import DraftRepository
from draftlet_api.services.draft_service import draft_read
from draftlet_api.services.ollama_client import OllamaClient


class GenerationService:
    def __init__(self, db: AsyncSession):
        self.conversations = ConversationRepository(db)
        self.drafts = DraftRepository(db)
        self.ollama = OllamaClient()

    async def generate(self, payload: GenerationCreate) -> DraftRead:
        conversation = await self.conversations.get(payload.conversation_id)
        if not conversation:
            raise NotFoundError("conversation", str(payload.conversation_id))

        context = "\n".join(
            f"{message.author}: {message.body}" for message in conversation.messages
        )
        instruction = (
            payload.instruction
            or f"Write a {payload.tone.lower()} reply. {payload.length} length. {payload.coverage}."
        )

        text = await self.ollama.chat(
            [
                {
                    "role": "system",
                    "content": "You write concise, helpful replies. Return only the draft reply.",
                },
                {
                    "role": "user",
                    "content": f"Conversation:\n{context}\n\nInstruction: {instruction}",
                },
            ],
            payload.model_override,
        )

        draft = Draft(
            conversation_id=conversation.id,
            status="ready",
            title=f"Reply to {conversation.title}",
            provider=f"ollama:{payload.model_override or self.ollama.settings.ollama_default_model}",
            instruction=instruction,
            text=text,
            selected_messages=[
                {"author": message.author, "detail": message.body}
                for message in conversation.messages[-5:]
            ],
            references=[conversation.participants] if conversation.participants else [],
        )

        return draft_read(await self.drafts.save(draft))
