import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FocusSnapshot } from '../../core/focus';
import { insertReply } from '../../core/insertion';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.stubGlobal('InputEvent', window.InputEvent);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('insertReply', () => {
  it('inserts into a focused input at the captured selection', async () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'Hello world';
    document.body.append(input);
    const inputEvents: InputEvent[] = [];
    input.addEventListener('input', (event) => inputEvents.push(event as InputEvent));

    const result = await insertReply('Draftlet', {
      element: input,
      selectionStart: 6,
      selectionEnd: 11,
    });

    expect(result.status).toBe('inserted');
    expect(input.value).toBe('Hello Draftlet');
    expect(input.selectionStart).toBe(14);
    expect(inputEvents).toHaveLength(1);
    expect(inputEvents[0].data).toBe('Draftlet');
  });

  it('inserts into a textarea and clamps stale selection bounds', async () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Short';
    document.body.append(textarea);

    const result = await insertReply(' reply', {
      element: textarea,
      selectionStart: 99,
      selectionEnd: 99,
    });

    expect(result.status).toBe('inserted');
    expect(textarea.value).toBe('Short reply');
  });

  it('inserts into a contenteditable element at the captured range', async () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    editable.textContent = 'Hello world';
    document.body.append(editable);
    const textNode = editable.firstChild!;
    const range = document.createRange();
    range.setStart(textNode, 6);
    range.setEnd(textNode, 11);

    const result = await insertReply('Draftlet', {
      element: editable,
      range,
    });

    expect(result.status).toBe('inserted');
    expect(editable.textContent).toBe('Hello Draftlet');
  });

  it('copies to clipboard when insertion target is unavailable', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const result = await insertReply('Copy me', null);

    expect(result.status).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('Copy me');
  });

  it('returns failed when insertion and clipboard fallback both fail', async () => {
    const input = document.createElement('input');
    input.type = 'text';
    const writeText = vi.fn(async () => {
      throw new Error('denied');
    });
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const result = await insertReply('Nope', { element: input } as FocusSnapshot);

    expect(result.status).toBe('failed');
  });
});
