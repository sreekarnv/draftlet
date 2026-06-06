import type { PanelView, Tone } from './types';

export const SERVER_BASE_URL = 'http://127.0.0.1:47632';
export const DEFAULT_TONE: Tone = 'professional';
export const TONES: Tone[] = ['professional', 'friendly', 'concise'];
export const DEFAULT_PANEL_VIEW: PanelView = 'replies';
export const PANEL_VIEWS: PanelView[] = ['replies', 'history'];
export const PREFERENCE_SCOPE = 'panel';
export const DEFAULT_TONE_PREFERENCE_KEY = 'default_tone';
export const LAST_PANEL_VIEW_PREFERENCE_KEY = 'last_panel_view';
