import {
  DEFAULT_PANEL_VIEW,
  DEFAULT_TONE,
  DEFAULT_TONE_PREFERENCE_KEY,
  LAST_PANEL_VIEW_PREFERENCE_KEY,
  PANEL_VIEWS,
  PREFERENCE_SCOPE,
  TONES,
} from './constants';
import { getPreferences, putPreference } from './api';
import type { PanelView, PreferenceItem, Tone } from './types';

let savedTone: Tone = DEFAULT_TONE;
let savedPanelView: PanelView = DEFAULT_PANEL_VIEW;

export async function getSavedTone(): Promise<Tone> {
  try {
    const preferences = await getPreferences(PREFERENCE_SCOPE);
    const tone = findPreferenceValue(preferences, DEFAULT_TONE_PREFERENCE_KEY);

    if (isTone(tone)) {
      savedTone = tone;
    }
  } catch {
    // Keep Draftlet usable when the local server is offline.
  }

  return savedTone;
}

export async function saveTone(tone: Tone): Promise<void> {
  if (!isTone(tone)) {
    return;
  }

  savedTone = tone;

  try {
    await putPreference({
      scope: PREFERENCE_SCOPE,
      key: DEFAULT_TONE_PREFERENCE_KEY,
      value: tone,
    });
  } catch {
    // The in-memory value remains available for the current page session.
  }
}

export async function getSavedPanelView(): Promise<PanelView> {
  try {
    const preferences = await getPreferences(PREFERENCE_SCOPE);
    const panelView = findPreferenceValue(preferences, LAST_PANEL_VIEW_PREFERENCE_KEY);

    if (isPanelView(panelView)) {
      savedPanelView = panelView;
    }
  } catch {
    // Keep the default view when the local server is offline.
  }

  return savedPanelView;
}

export async function savePanelView(panelView: PanelView): Promise<void> {
  if (!isPanelView(panelView)) {
    return;
  }

  savedPanelView = panelView;

  try {
    await putPreference({
      scope: PREFERENCE_SCOPE,
      key: LAST_PANEL_VIEW_PREFERENCE_KEY,
      value: panelView,
    });
  } catch {
    // The in-memory value remains available for the current page session.
  }
}

function findPreferenceValue(preferences: PreferenceItem[], key: string): string | undefined {
  return preferences.find((preference) => preference.key === key)?.value;
}

function isTone(value: string | undefined): value is Tone {
  return Boolean(value && TONES.includes(value as Tone));
}

function isPanelView(value: string | undefined): value is PanelView {
  return Boolean(value && PANEL_VIEWS.includes(value as PanelView));
}
