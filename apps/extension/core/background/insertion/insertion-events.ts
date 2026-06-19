import {
  INSERTION_IN_PROGRESS,
  type DraftletMessage,
} from '../../messages';
import { emitDraftletMessage } from '../shared-helpers';

export async function handleInsertionInProgress(sessionId: string, message: string): Promise<void> {
  // Fire-and-forget broadcast to the side panel so it can flip the
  // "Click the compose field to insert." pending UI while the content
  // script's INSERT_REPLY handler is still awaiting the arm resolution.
  await emitDraftletMessage({
    type: INSERTION_IN_PROGRESS,
    sessionId,
    message,
  } satisfies DraftletMessage).catch(() => undefined);
}
