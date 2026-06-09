import type { ConversationThreadSnapshot, DraftVariant, Turn } from '../../core/messages';

export interface ThreadTurnGroup {
  turn: Turn;
  variants: DraftVariant[];
  isLatest: boolean;
}

export interface ThreadWorkspaceModel {
  groups: ThreadTurnGroup[];
  totalVariants: number;
}

export function buildThreadWorkspace(snapshot: ConversationThreadSnapshot): ThreadWorkspaceModel {
  const turns = [...snapshot.turns].sort(compareByCreatedAt);
  const latestTurnId = snapshot.thread.latestTurnId ?? turns.at(-1)?.turnId;
  const groups = turns.map((turn) => {
    const variants = snapshot.variants
      .filter((variant) => variant.turnId === turn.turnId)
      .sort((a, b) => a.rank - b.rank || a.createdAt.localeCompare(b.createdAt));

    return {
      turn,
      variants,
      isLatest: turn.turnId === latestTurnId,
    };
  });

  return {
    groups,
    totalVariants: groups.reduce((count, group) => count + group.variants.length, 0),
  };
}

function compareByCreatedAt(a: Turn, b: Turn) {
  return a.createdAt.localeCompare(b.createdAt) || a.turnId.localeCompare(b.turnId);
}
