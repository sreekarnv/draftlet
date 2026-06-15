import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInsertionTargetStore } from '../../core/insertion-target-store';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('InsertionTargetStore', () => {
  it('captures a textarea when it receives a focusin event', () => {
    const textarea = document.createElement('textarea');
    textarea.id = 'compose-body';
    textarea.value = 'Hello there';
    document.body.append(textarea);

    const store = createInsertionTargetStore();
    store.noteFocusIn(textarea);

    const live = store.getLiveSnapshot();
    expect(live).not.toBeNull();
    expect(live?.element).toBe(textarea);
    expect(live?.targetRef?.kind).toBe('textarea');
  });

  it('does not clear a saved editable snapshot when a non-editable element receives focus', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Compose body';
    document.body.append(textarea);

    const toolbar = document.createElement('div');
    toolbar.id = 'format-toolbar';
    document.body.append(toolbar);

    const store = createInsertionTargetStore();
    store.noteFocusIn(textarea);
    store.noteFocusIn(toolbar);

    const live = store.getLiveSnapshot();
    expect(live?.element).toBe(textarea);
  });

  it('keeps the saved snapshot when the page loses focus to the side panel (no further focusin on the page)', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Compose body';
    document.body.append(textarea);

    const store = createInsertionTargetStore();
    store.noteFocusIn(textarea);

    textarea.blur();
    const live = store.getLiveSnapshot();
    expect(live?.element).toBe(textarea);
  });

  it('captures a contenteditable host via pointerdown even before it is focused', () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    editable.setAttribute('aria-label', 'Reply body');
    document.body.append(editable);

    const store = createInsertionTargetStore();
    store.notePointerDown(editable);

    const live = store.getLiveSnapshot();
    expect(live?.element).toBe(editable);
    expect(live?.targetRef?.kind).toBe('contenteditable');
  });

  it('captures a role="textbox" host as an editable target', () => {
    const textbox = document.createElement('div');
    textbox.setAttribute('role', 'textbox');
    textbox.setAttribute('aria-label', 'Custom editor');
    document.body.append(textbox);

    const store = createInsertionTargetStore();
    store.noteFocusIn(textbox);

    const live = store.getLiveSnapshot();
    expect(live?.element).toBe(textbox);
    expect(live?.targetRef?.kind).toBe('contenteditable');
  });

  it('forgets a snapshot whose element was removed from the DOM', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Compose body';
    document.body.append(textarea);

    const store = createInsertionTargetStore();
    store.noteFocusIn(textarea);
    textarea.remove();

    expect(store.getLiveSnapshot()).toBeNull();
  });

  it('treats a disconnected disabled input as unavailable', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.disabled = true;
    document.body.append(input);

    const store = createInsertionTargetStore();
    store.noteFocusIn(input);

    expect(store.getLiveSnapshot()).toBeNull();
  });

  it('captures the activeElement when the floating trigger is clicked', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Compose body';
    document.body.append(textarea);
    textarea.focus();

    const store = createInsertionTargetStore();
    const captured = store.rememberTriggerCapture();

    expect(captured?.element).toBe(textarea);
  });

  it('refreshes the cached selection bounds from the live textarea on selectionchange', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Hello world';
    document.body.append(textarea);
    textarea.focus();
    textarea.setSelectionRange(0, 5);

    const store = createInsertionTargetStore();
    store.noteFocusIn(textarea);
    textarea.setSelectionRange(6, 11);
    store.noteSelectionChange();

    const live = store.getLiveSnapshot();
    expect(live?.selectionStart).toBe(6);
    expect(live?.selectionEnd).toBe(11);
  });
});

describe('InsertionTargetStore.isValidForInsertion', () => {
  it('reports no-target when nothing has been captured', () => {
    const store = createInsertionTargetStore();
    expect(store.isValidForInsertion()).toEqual({ valid: false, reason: 'no-target', snapshot: null });
  });

  it('reports disconnected when the captured element is removed from the DOM', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Compose body';
    document.body.append(textarea);

    const store = createInsertionTargetStore();
    store.noteFocusIn(textarea);
    textarea.remove();

    expect(store.isValidForInsertion().valid).toBe(false);
    expect(store.isValidForInsertion().reason).toBe('disconnected');
  });

  it('reports disabled when the cached textarea is disabled', () => {
    const textarea = document.createElement('textarea');
    textarea.disabled = true;
    document.body.append(textarea);

    const store = createInsertionTargetStore();
    store.noteFocusIn(textarea);

    expect(store.isValidForInsertion().valid).toBe(false);
    expect(store.isValidForInsertion().reason).toBe('disabled');
  });

  it('reports readonly when the cached textarea is readOnly', () => {
    const textarea = document.createElement('textarea');
    textarea.readOnly = true;
    document.body.append(textarea);

    const store = createInsertionTargetStore();
    store.noteFocusIn(textarea);

    expect(store.isValidForInsertion().valid).toBe(false);
    expect(store.isValidForInsertion().reason).toBe('readonly');
  });

  it('reports valid for a connected editable textarea', () => {
    const textarea = document.createElement('textarea');
    document.body.append(textarea);

    const store = createInsertionTargetStore();
    store.noteFocusIn(textarea);

    const result = store.isValidForInsertion();
    expect(result.valid).toBe(true);
    expect(result.snapshot?.element).toBe(textarea);
  });
});

describe('InsertionTargetStore.armCaptureForNextEditable', () => {
  it('resolves with a snapshot when an editable element is focused after arm', async () => {
    const textarea = document.createElement('textarea');
    document.body.append(textarea);

    const store = createInsertionTargetStore();

    const promise = store.armCaptureForNextEditable({ timeoutMs: 500 });
    expect(store.isArmed()).toBe(true);

    textarea.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    textarea.focus();

    const captured = await promise;
    expect(captured).not.toBeNull();
    expect(captured?.element).toBe(textarea);
    expect(store.isArmed()).toBe(false);
  });

  it('resolves with null on timeout and clears the armed state', async () => {
    const store = createInsertionTargetStore();

    const captured = await store.armCaptureForNextEditable({ timeoutMs: 30 });

    expect(captured).toBeNull();
    expect(store.isArmed()).toBe(false);
  });

  it('captures a pointerdown on an editable as well', async () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    document.body.append(editable);

    const store = createInsertionTargetStore();
    const promise = store.armCaptureForNextEditable({ timeoutMs: 500 });

    editable.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    const captured = await promise;
    expect(captured?.element).toBe(editable);
  });

  it('ignores pointerdown on a non-editable element and keeps waiting', async () => {
    const toolbar = document.createElement('div');
    document.body.append(toolbar);

    const textarea = document.createElement('textarea');
    document.body.append(textarea);

    const store = createInsertionTargetStore();
    const promise = store.armCaptureForNextEditable({ timeoutMs: 500 });

    toolbar.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    textarea.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    textarea.focus();

    const captured = await promise;
    expect(captured?.element).toBe(textarea);
  });

  it('cancels a prior arm when a new arm is requested', async () => {
    const store = createInsertionTargetStore();

    const first = store.armCaptureForNextEditable({ timeoutMs: 200 });
    const firstController = store;
    expect(firstController.isArmed()).toBe(true);

    const second = store.armCaptureForNextEditable({ timeoutMs: 30 });
    expect(store.isArmed()).toBe(true);

    const firstResult = await first;
    const secondResult = await second;

    expect(firstResult).toBeNull();
    expect(secondResult).toBeNull();
  });

  it('cancelArm prevents the listeners from firing', async () => {
    const textarea = document.createElement('textarea');
    document.body.append(textarea);

    const store = createInsertionTargetStore();
    const promise = store.armCaptureForNextEditable({ timeoutMs: 500 });
    store.cancelArm();

    textarea.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    textarea.focus();

    const captured = await promise;
    expect(captured).toBeNull();
    expect(store.isArmed()).toBe(false);
  });
});

describe('InsertionTargetStore [draftlet:target] logs', () => {
  it('emits a captured log line when a textarea is captured', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const textarea = document.createElement('textarea');
    textarea.id = 'compose-body';
    document.body.append(textarea);

    const store = createInsertionTargetStore();
    store.noteFocusIn(textarea);

    expect(info).toHaveBeenCalled();
    const message = info.mock.calls.map((call) => call[0]).find((line) => typeof line === 'string' && line.startsWith('[draftlet:target]'));
    expect(message).toBeDefined();
    expect(message as string).toContain('captured');
    expect(message as string).toContain('kind=textarea');
  });
});
