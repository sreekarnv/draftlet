import type { Coverage, Draft, DraftVariant, Length, Tone } from "@/lib/contracts";

export type DraftSettings = {
  tone: Tone;
  length: Length;
  coverage: Coverage;
};

export type DraftSource = {
  title: string;
  connector: string;
  contact: string;
};

export type WorkspaceToast = {
  id: number;
  message: string;
};

export type DraftVariantListItem = Pick<DraftVariant, "id" | "title" | "detail">;

export type EditorToolbarProps = {
  title: string;
  provider: string;
  draftStatus: string;
  onSave: () => void;
  onCopy: () => void;
  onInsert: () => void;
  onMarkSent: () => void;
};

export type DraftWorkspaceView = {
  draft?: Draft;
  activeVariant?: DraftVariant;
  draftText: string;
  selectedVariant: string;
  settings: DraftSettings;
  source: DraftSource;
  statusLabel: string;
  isInserted: boolean;
  draftIsSent: boolean;
  isGeneratingVariant: boolean;
  userIsEditing: boolean;
  toast: WorkspaceToast | null;
  setTone: (value: Tone) => void;
  setLength: (value: Length) => void;
  setCoverage: (value: Coverage) => void;
  setDraftText: (value: string) => void;
  selectVariant: (id: string) => void;
  save: () => void;
  copy: () => void;
  insert: () => void;
  markSent: () => void;
  generateVariant: () => void;
};
