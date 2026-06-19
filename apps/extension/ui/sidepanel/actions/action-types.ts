import type { PanelView, Tone } from '../../../core/types';

export interface SidePanelStorage {
  getSavedTone(): Promise<Tone>;
  getSavedPanelView(): Promise<PanelView>;
  saveTone(tone: Tone): Promise<void>;
  savePanelView(view: PanelView): Promise<void>;
}

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface VariantActionResult {
  ok: boolean;
  message: string;
}
