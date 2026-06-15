import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logTargetEvent } from '../../core/draftlet-log';

let infoSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  infoSpy.mockRestore();
});

describe('logTargetEvent', () => {
  it('prefixes the message with [draftlet:target]', () => {
    logTargetEvent('captured', { kind: 'textarea' });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const [firstArg] = infoSpy.mock.calls[0];
    expect(typeof firstArg).toBe('string');
    expect(firstArg as string).toMatch(/^\[draftlet:target\] captured kind=textarea$/);
  });

  it('omits undefined and null fields from the formatted line', () => {
    logTargetEvent('recapture status', { valid: true, reason: 'cached', extra: undefined });

    const [firstArg] = infoSpy.mock.calls[0];
    expect(firstArg as string).toBe('[draftlet:target] recapture status valid=true reason=cached');
  });

  it('emits a structured captured line with kind, tagName, id, and label when provided', () => {
    logTargetEvent('captured', {
      kind: 'contenteditable',
      tagName: 'div',
      id: 'reply-body',
      label: 'Reply body',
    });

    const [firstArg] = infoSpy.mock.calls[0];
    expect(firstArg as string).toBe('[draftlet:target] captured kind=contenteditable tagName=div id=reply-body label=Reply body');
  });

  it('formats the unavailable line with a reason', () => {
    logTargetEvent('unavailable', { reason: 'disconnected' });

    const [firstArg] = infoSpy.mock.calls[0];
    expect(firstArg as string).toBe('[draftlet:target] unavailable reason=disconnected');
  });
});
