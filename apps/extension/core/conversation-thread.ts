import type {
  ConversationThread,
  ConversationThreadSnapshot,
  DraftVariant,
  DraftletSidePanelContext,
  SourceSnapshot,
  Turn,
  TurnGenerationStatus,
} from './messages';
import type { Tone } from './types';

interface ConversationThreadStoreOptions {
  createId?: (prefix: string) => string;
  now?: () => Date;
}

interface EnsureThreadInput {
  sessionId: string;
  activeThreadId?: string;
  context: DraftletSidePanelContext;
}

interface CreateTurnInput {
  threadId: string;
  context: DraftletSidePanelContext;
  tone: Tone;
  instruction?: string;
}

interface AddVariantInput {
  turnId: string;
  tone: Tone;
  content: string;
  persistedReplyId?: number;
}

export interface ConversationThreadStore {
  ensureThreadForSession(input: EnsureThreadInput): ConversationThreadSnapshot;
  getSnapshot(threadId: string): ConversationThreadSnapshot | null;
  getSnapshotForSession(sessionId: string): ConversationThreadSnapshot | null;
  createTurn(input: CreateTurnInput): { snapshot: ConversationThreadSnapshot; turn: Turn } | null;
  addVariant(input: AddVariantInput): { snapshot: ConversationThreadSnapshot; variant: DraftVariant } | null;
  updateTurnStatus(turnId: string, status: TurnGenerationStatus): ConversationThreadSnapshot | null;
  hydrateSnapshot(snapshot: ConversationThreadSnapshot): ConversationThreadSnapshot;
}

export function createConversationThreadStore({
  createId = createDomainId,
  now = () => new Date(),
}: ConversationThreadStoreOptions = {}): ConversationThreadStore {
  const threadsById = new Map<string, ConversationThread>();
  const threadIdBySessionId = new Map<string, string>();
  const turnsById = new Map<string, Turn>();
  const turnIdsByThreadId = new Map<string, string[]>();
  const variantsById = new Map<string, DraftVariant>();
  const variantIdsByTurnId = new Map<string, string[]>();

  const timestamp = () => now().toISOString();

  return {
    ensureThreadForSession({ sessionId, activeThreadId, context }) {
      const existingThreadId = activeThreadId ?? threadIdBySessionId.get(sessionId);
      const existing = existingThreadId ? threadsById.get(existingThreadId) : undefined;
      const source = toSourceSnapshot(context);

      if (existing) {
        const updated = {
          ...existing,
          source,
          updatedAt: timestamp(),
        };
        threadsById.set(updated.threadId, updated);
        threadIdBySessionId.set(sessionId, updated.threadId);
        return snapshot(updated.threadId)!;
      }

      const createdAt = timestamp();
      const thread: ConversationThread = {
        threadId: createId('thread'),
        sessionId,
        source,
        status: 'active',
        createdAt,
        updatedAt: createdAt,
      };

      threadsById.set(thread.threadId, thread);
      threadIdBySessionId.set(sessionId, thread.threadId);
      turnIdsByThreadId.set(thread.threadId, []);
      return snapshot(thread.threadId)!;
    },

    getSnapshot(threadId) {
      return snapshot(threadId);
    },

    getSnapshotForSession(sessionId) {
      const threadId = threadIdBySessionId.get(sessionId);
      return threadId ? snapshot(threadId) : null;
    },

    createTurn({ threadId, context, tone, instruction = 'Generate reply drafts' }) {
      const thread = threadsById.get(threadId);

      if (!thread) {
        return null;
      }

      const createdAt = timestamp();
      const turn: Turn = {
        turnId: createId('turn'),
        threadId,
        instruction,
        source: toSourceSnapshot(context),
        tone,
        generationStatus: 'queued',
        createdAt,
        updatedAt: createdAt,
      };
      turnsById.set(turn.turnId, turn);

      const turnIds = [...(turnIdsByThreadId.get(threadId) ?? []), turn.turnId];
      turnIdsByThreadId.set(threadId, turnIds);
      threadsById.set(threadId, {
        ...thread,
        latestTurnId: turn.turnId,
        updatedAt: createdAt,
      });
      variantIdsByTurnId.set(turn.turnId, []);

      return { snapshot: snapshot(threadId)!, turn };
    },

    addVariant({ turnId, tone, content, persistedReplyId }) {
      const turn = turnsById.get(turnId);

      if (!turn) {
        return null;
      }

      const variantIds = variantIdsByTurnId.get(turnId) ?? [];
      const createdAt = timestamp();
      const variant: DraftVariant = {
        variantId: createId('variant'),
        turnId,
        tone,
        content,
        rank: variantIds.length,
        status: 'generated',
        persistedReplyId,
        createdAt,
        updatedAt: createdAt,
      };

      variantsById.set(variant.variantId, variant);
      variantIdsByTurnId.set(turnId, [...variantIds, variant.variantId]);
      touchThread(turn.threadId, createdAt);

      return { snapshot: snapshot(turn.threadId)!, variant };
    },

    updateTurnStatus(turnId, status) {
      const turn = turnsById.get(turnId);

      if (!turn) {
        return null;
      }

      const updatedAt = timestamp();
      turnsById.set(turnId, {
        ...turn,
        generationStatus: status,
        updatedAt,
      });
      touchThread(turn.threadId, updatedAt);
      return snapshot(turn.threadId);
    },

    hydrateSnapshot(snapshotValue) {
      threadsById.set(snapshotValue.thread.threadId, snapshotValue.thread);
      threadIdBySessionId.set(snapshotValue.thread.sessionId, snapshotValue.thread.threadId);
      turnIdsByThreadId.set(
        snapshotValue.thread.threadId,
        snapshotValue.turns.map((turn) => turn.turnId),
      );

      for (const turn of snapshotValue.turns) {
        turnsById.set(turn.turnId, turn);
        variantIdsByTurnId.set(
          turn.turnId,
          snapshotValue.variants
            .filter((variant) => variant.turnId === turn.turnId)
            .sort((a, b) => a.rank - b.rank)
            .map((variant) => variant.variantId),
        );
      }

      for (const variant of snapshotValue.variants) {
        variantsById.set(variant.variantId, variant);
      }

      return snapshot(snapshotValue.thread.threadId)!;
    },
  };

  function touchThread(threadId: string, updatedAt: string) {
    const thread = threadsById.get(threadId);

    if (!thread) {
      return;
    }

    threadsById.set(threadId, {
      ...thread,
      updatedAt,
    });
  }

  function snapshot(threadId: string): ConversationThreadSnapshot | null {
    const thread = threadsById.get(threadId);

    if (!thread) {
      return null;
    }

    const turns = (turnIdsByThreadId.get(threadId) ?? [])
      .map((turnId) => turnsById.get(turnId))
      .filter((turn): turn is Turn => Boolean(turn));
    const variants = turns.flatMap((turn) => (variantIdsByTurnId.get(turn.turnId) ?? [])
      .map((variantId) => variantsById.get(variantId))
      .filter((variant): variant is DraftVariant => Boolean(variant)));

    return {
      thread,
      turns,
      variants,
    };
  }
}

export function toSourceSnapshot(context: DraftletSidePanelContext): SourceSnapshot {
  return {
    selectedText: context.selectedText.trim(),
    sourceUrl: context.sourceUrl,
    sourceDomain: context.sourceDomain || undefined,
    pageTitle: context.pageTitle || undefined,
  };
}

function createDomainId(prefix: string): string {
  if (typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
