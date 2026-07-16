export enum LibraryFilter {
  ALL = "all",
  GMAIL = "gmail",
  TELEGRAM = "telegram",
  DRAFT_PENDING = "draft-pending",
  NEEDS_FOLLOW_UP = "needs-follow-up",
  RECENTLY_CAPTURED = "recently-captured",
}

export type LibraryTab = {
  id: LibraryFilter;
  label: string;
};
