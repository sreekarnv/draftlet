import type { PlausibleTabCandidate } from '../../tab-disambiguation';
import type { createDraftletError } from '../shared-helpers';

export type InsertionTabResolution =
  | { status: 'resolved'; tab: Browser.tabs.Tab }
  | { status: 'ambiguous'; candidates: PlausibleTabCandidate[] }
  | { status: 'missing' };

export type ActivateRecaptureTabResult = {
  activated: boolean;
  tab?: PlausibleTabCandidate;
  error?: ReturnType<typeof createDraftletError>;
  message: string;
};
