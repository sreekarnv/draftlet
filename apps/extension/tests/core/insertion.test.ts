import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FocusSnapshot } from '../../core/focus';
import { insertReply, resolveTarget } from '../../core/insertion';

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

  it('inserts into a stored textarea even when it is no longer the active element', async () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Compose body';
    document.body.append(textarea);
    textarea.focus();
    textarea.setSelectionRange(8, 12);
    textarea.blur();

    const snapshot: FocusSnapshot = { element: textarea, selectionStart: 8, selectionEnd: 12 };
    const result = await insertReply('reply', snapshot);

    expect(result.status).toBe('inserted');
    expect(textarea.value).toBe('Compose reply');
    expect(document.activeElement).toBe(textarea);
  });

  it('inserts into a stored contenteditable element even when it is not the active element', async () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    editable.textContent = 'Hello world';
    document.body.append(editable);
    const textNode = editable.firstChild!;
    const range = document.createRange();
    range.setStart(textNode, 6);
    range.setEnd(textNode, 11);

    editable.blur();
    expect(document.activeElement).not.toBe(editable);

    const result = await insertReply('Draftlet', { element: editable, range });

    expect(result.status).toBe('inserted');
    expect(editable.textContent).toBe('Hello Draftlet');
    expect(document.activeElement).toBe(editable);
  });

  it('returns target_unavailable and falls back to copy when the stored element is no longer in the DOM', async () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Compose body';
    document.body.append(textarea);
    const snapshot: FocusSnapshot = { element: textarea, selectionStart: 0, selectionEnd: 0 };

    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    textarea.remove();

    const result = await insertReply('Copy me', snapshot);

    expect(result.status).toBe('copied');
    expect(result.targetStatus).toBe('unavailable');
    expect(result.errorCode).toBe('target_missing');
    expect(writeText).toHaveBeenCalledWith('Copy me');
  });

  it('returns target_unavailable and falls back to copy when the stored element is disabled', async () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Compose body';
    textarea.disabled = true;
    document.body.append(textarea);

    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const result = await insertReply('Copy me', { element: textarea });

    expect(result.status).toBe('copied');
    expect(result.targetStatus).toBe('unavailable');
    expect(result.errorCode).toBe('target_missing');
    expect(writeText).toHaveBeenCalledWith('Copy me');
  });

  it('copies to clipboard when insertion target is unavailable', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const result = await insertReply('Copy me', null);

    expect(result.status).toBe('copied');
    expect(result.targetStatus).toBe('unavailable');
    expect(result.errorCode).toBe('target_missing');
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
    expect(result.targetStatus).toBe('unavailable');
    expect(result.errorCode).toBe('target_missing_clipboard_failed');
  });
});

describe('resolveTarget', () => {
  it('reports live for a connected textarea', () => {
    const textarea = document.createElement('textarea');
    document.body.append(textarea);

    expect(resolveTarget({ element: textarea })).toEqual({ availability: 'live' });
  });

  it('reports unavailable for a null target', () => {
    expect(resolveTarget(null)).toEqual({ availability: 'unavailable', reason: 'target_missing' });
  });

  it('reports unavailable when the element has been disconnected from the DOM', () => {
    const textarea = document.createElement('textarea');
    document.body.append(textarea);
    const snapshot: FocusSnapshot = { element: textarea };
    textarea.remove();

    expect(resolveTarget(snapshot)).toEqual({ availability: 'unavailable', reason: 'target_stale' });
  });
});

describe('insertReply after blur (side panel stole focus)', () => {
  it('inserts into the cached textarea after it loses focus', async () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Compose body';
    document.body.append(textarea);
    textarea.focus();
    textarea.setSelectionRange(0, 6);

    textarea.blur();
    expect(document.activeElement).not.toBe(textarea);

    const snapshot: FocusSnapshot = { element: textarea, selectionStart: 0, selectionEnd: 6 };
    const result = await insertReply('Hi', snapshot);

    expect(result.status).toBe('inserted');
    expect(textarea.value).toBe('Hie body');
    expect(document.activeElement).toBe(textarea);
  });

  it('inserts into a cached contenteditable element after it loses focus', async () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    editable.textContent = 'Hello world';
    document.body.append(editable);
    const textNode = editable.firstChild!;
    const range = document.createRange();
    range.setStart(textNode, 6);
    range.setEnd(textNode, 11);

    editable.blur();
    expect(document.activeElement).not.toBe(editable);

    const result = await insertReply('Draftlet', { element: editable, range });

    expect(result.status).toBe('inserted');
    expect(editable.textContent).toBe('Hello Draftlet');
    expect(document.activeElement).toBe(editable);
  });

  it('does not consult document.activeElement during insertion', async () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Compose body';
    document.body.append(textarea);

    const originalActiveElement = document.body;
    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      get: () => originalActiveElement,
    });

    const snapshot: FocusSnapshot = { element: textarea, selectionStart: 0, selectionEnd: 0 };
    const result = await insertReply('Hello', snapshot);

    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      get: () => textarea,
    });

    expect(result.status).toBe('inserted');
    expect(textarea.value).toBe('HelloCompose body');
  });
});
