import { describe, expect, it } from 'vitest';

import {
  getDesktopStartupMode,
  getTrayRuntimeStatusLabel,
  getTrayTooltip,
} from '../../src/main/desktop-lifecycle';

describe('getDesktopStartupMode', () => {
  it('opens setup before first-run setup is complete', () => {
    expect(getDesktopStartupMode(false)).toBe('setup-window');
  });

  it('starts tray-only after first-run setup is complete', () => {
    expect(getDesktopStartupMode(true)).toBe('tray-only');
  });
});

describe('tray runtime status labels', () => {
  it('shows ready when runtime health is ok', () => {
    expect(getTrayRuntimeStatusLabel({ ok: true, message: 'Draftlet server ready.', code: 'ready' })).toBe('Runtime: ready');
  });

  it('shows port conflict distinctly', () => {
    expect(getTrayRuntimeStatusLabel({ ok: false, message: 'Port conflict.', code: 'conflict' })).toBe('Runtime: port conflict');
  });

  it('keeps runtime status visible in the tray tooltip', () => {
    expect(getTrayTooltip({ ok: false, message: 'Socket closed.', code: 'offline' })).toBe('Draftlet - offline');
  });
});
