from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from draftlet_api.database.engine import get_db
from draftlet_api.dtos.conversation import ConversationCreate, ConversationList, ConversationRead, ConversationUpdate
from draftlet_api.dtos.message import MessageCreate, MessageRead
from draftlet_api.services.runtime import RuntimeService, conversation_dto

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=ConversationList)
async def list_conversations(db: AsyncSession = Depends(get_db)) -> ConversationList:
    return ConversationList(items=await RuntimeService(db).conversations())


@router.post("", response_model=ConversationRead, status_code=status.HTTP_201_CREATED)
async def create_conversation(data: ConversationCreate, db: AsyncSession = Depends(get_db)) -> ConversationRead:
    return await RuntimeService(db).create_conversation(data)


@router.get("/{conversation_id}", response_model=ConversationRead)
async def get_conversation(conversation_id: UUID, db: AsyncSession = Depends(get_db)) -> ConversationRead:
    return conversation_dto(await RuntimeService(db).conversation(conversation_id))


@router.patch("/{conversation_id}", response_model=ConversationRead)
async def update_conversation(conversation_id: UUID, data: ConversationUpdate, db: AsyncSession = Depends(get_db)) -> ConversationRead:
    return await RuntimeService(db).update_conversation(conversation_id, data)


@router.post("/{conversation_id}/messages", response_model=MessageRead, status_code=status.HTTP_201_CREATED)
async def add_message(conversation_id: UUID, data: MessageCreate, db: AsyncSession = Depends(get_db)) -> MessageRead:
    return await RuntimeService(db).add_message(conversation_id, data)
