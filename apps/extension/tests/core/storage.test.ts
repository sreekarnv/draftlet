import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PreferenceItem, PreferenceUpsert } from '../../core/types';

const getPreferences = vi.fn();
const putPreference = vi.fn();

vi.mock('../../core/api', () => ({
  getPreferences,
  putPreference,
}));

beforeEach(() => {
  vi.resetModules();
  getPreferences.mockReset();
  putPreference.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('storage preferences', () => {
  it('loads saved tone from panel preferences', async () => {
    getPreferences.mockResolvedValue([preference('default_tone', 'friendly')]);
    const { getSavedTone } = await import('../../core/storage');

    await expect(getSavedTone()).resolves.toBe('friendly');
    expect(getPreferences).toHaveBeenCalledWith('panel');
  });

  it('ignores invalid saved tone values', async () => {
    getPreferences.mockResolvedValue([preference('default_tone', 'pirate')]);
    const { getSavedTone } = await import('../../core/storage');

    await expect(getSavedTone()).resolves.toBe('professional');
  });

  it('saves tone through the preferences API', async () => {
    putPreference.mockResolvedValue(preference('default_tone', 'concise'));
    const { saveTone } = await import('../../core/storage');

    await saveTone('concise');

    expect(putPreference).toHaveBeenCalledWith({
      scope: 'panel',
      key: 'default_tone',
      value: 'concise',
    } satisfies PreferenceUpsert);
  });

  it('falls back from removed favorites view and saves valid panel views', async () => {
    getPreferences.mockResolvedValue([preference('last_panel_view', 'favorites')]);
    putPreference.mockResolvedValue(preference('last_panel_view', 'history'));
    const { getSavedPanelView, savePanelView } = await import('../../core/storage');

    await expect(getSavedPanelView()).resolves.toBe('replies');
    await savePanelView('history');

    expect(putPreference).toHaveBeenCalledWith({
      scope: 'panel',
      key: 'last_panel_view',
      value: 'history',
    } satisfies PreferenceUpsert);
  });

  it('keeps in-memory values when preference writes fail', async () => {
    putPreference.mockRejectedValue(new Error('offline'));
    getPreferences.mockRejectedValue(new Error('offline'));
    const { getSavedTone, saveTone } = await import('../../core/storage');

    await saveTone('friendly');

    await expect(getSavedTone()).resolves.toBe('friendly');
  });
});

function preference(key: string, value: string): PreferenceItem {
  return {
    id: 1,
    scope: 'panel',
    key,
    value,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
  };
}
