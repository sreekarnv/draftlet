import { SERVER_BASE_URL } from '../constants';
import type { ConversationThreadSnapshot, DraftVariant } from '../messages';
import { patchJson, putJson } from './transport';
import {
  mapConversationThreadSnapshot,
  mapDraftVariant,
  type ConversationThreadSnapshotRead,
  type DraftVariantRead,
} from './mappers';

export async function putDraftVariant(variant: DraftVariant): Promise<DraftVariant> {
  const response = await putJson<DraftVariantRead>(`${SERVER_BASE_URL}/domain/variants/${encodeURIComponent(variant.variantId)}`, {
    variant_id: variant.variantId,
    turn_id: variant.turnId,
    tone: variant.tone,
    length: variant.length,
    content: variant.content,
    rank: variant.rank,
    status: variant.status,
    is_current: variant.isCurrent,
  });

  return mapDraftVariant(response);
}

export async function patchDraftVariantState(
  variantId: string,
  state: { isCurrent?: boolean; status?: DraftVariant['status'] },
): Promise<ConversationThreadSnapshot> {
  const response = await patchJson<ConversationThreadSnapshotRead>(`${SERVER_BASE_URL}/domain/variants/${encodeURIComponent(variantId)}/state`, {
    is_current: state.isCurrent,
    status: state.status,
  });

  return mapConversationThreadSnapshot(response);
}
