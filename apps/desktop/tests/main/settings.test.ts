import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { appGetPath } from '../electron-mock';

vi.mock('electron', () => ({
  app: { getPath: appGetPath },
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
}));

import {
  RECOMMENDED_MODEL,
  getSelectedModelSetting,
  setSelectedModelSetting,
} from '../../src/main/ipc/settings';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'draftlet-settings-'));
  appGetPath.mockImplementation((key: string) => {
    if (key === 'userData') {
      return tmpDir;
    }
    return tmpDir;
  });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  vi.clearAllMocks();
});

describe('getSelectedModelSetting / setSelectedModelSetting', () => {
  it('returns null when no settings file exists', async () => {
    await expect(getSelectedModelSetting()).resolves.toBeNull();
  });

  it('round-trips the selected model through the settings file', async () => {
    await setSelectedModelSetting('llama3:8b');

    const stored = JSON.parse(readFileSync(path.join(tmpDir, 'settings.json'), 'utf8'));
    expect(stored).toEqual({ selectedModel: 'llama3:8b' });
    await expect(getSelectedModelSetting()).resolves.toBe('llama3:8b');
  });

  it('trims whitespace and treats empty values as null', async () => {
    await setSelectedModelSetting('  mistral:7b  ');
    await expect(getSelectedModelSetting()).resolves.toBe('mistral:7b');

    writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify({ selectedModel: '   ' }));
    await expect(getSelectedModelSetting()).resolves.toBeNull();
  });

  it('rejects an empty model name', async () => {
    await expect(setSelectedModelSetting('')).rejects.toThrow('Model name cannot be empty.');
    await expect(setSelectedModelSetting('   ')).rejects.toThrow('Model name cannot be empty.');
  });

  it('overwrites the selected model while preserving other settings', async () => {
    writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify({ selectedModel: 'old:1', another: 'keep' }));

    await setSelectedModelSetting('new:2');

    const stored = JSON.parse(readFileSync(path.join(tmpDir, 'settings.json'), 'utf8'));
    expect(stored).toEqual({ selectedModel: 'new:2', another: 'keep' });
  });

  it('exposes the recommended model constant', () => {
    expect(typeof RECOMMENDED_MODEL).toBe('string');
    expect(RECOMMENDED_MODEL.length).toBeGreaterThan(0);
  });
});
