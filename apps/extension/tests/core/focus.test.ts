import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { captureFocusedTarget, restoreTargetFromRef } from '../../core/focus';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('focus target capture', () => {
  it('captures bounded compose target metadata for contenteditable fields', () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    editable.setAttribute('aria-label', 'Reply body');
    editable.textContent = 'Hello';
    document.body.append(editable);

    const snapshot = captureFocusedTarget(editable);

    expect(snapshot?.targetRef).toMatchObject({
      kind: 'contenteditable',
      label: 'Reply body',
      selector: 'div[aria-label="Reply body"]',
    });
    expect(snapshot?.targetRef?.fingerprint).toContain('contenteditable');
  });

  it('captures a textarea including the selection bounds', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'Compose body';
    textarea.setSelectionRange(0, 5);
    document.body.append(textarea);

    const snapshot = captureFocusedTarget(textarea);

    expect(snapshot?.element).toBe(textarea);
    expect(snapshot?.targetRef?.kind).toBe('textarea');
    expect(snapshot?.selectionStart).toBe(0);
    expect(snapshot?.selectionEnd).toBe(5);
  });

  it('captures a text-like input field as a compose target', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'subject';
    document.body.append(input);

    const snapshot = captureFocusedTarget(input);

    expect(snapshot?.element).toBe(input);
    expect(snapshot?.targetRef?.kind).toBe('input');
    expect(snapshot?.targetRef?.label).toBe('subject');
  });

  it('captures an element with role="textbox" as a compose target', () => {
    const textbox = document.createElement('div');
    textbox.setAttribute('role', 'textbox');
    textbox.setAttribute('aria-label', 'Custom rich editor');
    document.body.append(textbox);

    const snapshot = captureFocusedTarget(textbox);

    expect(snapshot?.element).toBe(textbox);
    expect(snapshot?.targetRef?.kind).toBe('contenteditable');
    expect(snapshot?.targetRef?.label).toBe('Custom rich editor');
  });

  it('captures an element with role="combobox" as a compose target', () => {
    const combobox = document.createElement('div');
    combobox.setAttribute('role', 'combobox');
    combobox.setAttribute('aria-label', 'Recipients');
    document.body.append(combobox);

    const snapshot = captureFocusedTarget(combobox);

    expect(snapshot?.element).toBe(combobox);
    expect(snapshot?.targetRef?.kind).toBe('contenteditable');
  });

  it('skips aria-readonly textbox roles', () => {
    const readOnly = document.createElement('div');
    readOnly.setAttribute('role', 'textbox');
    readOnly.setAttribute('aria-readonly', 'true');
    document.body.append(readOnly);

    const snapshot = captureFocusedTarget(readOnly);

    expect(snapshot).toBeNull();
  });

  it('does not capture a non-text input like checkbox or submit', () => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    document.body.append(checkbox);

    const snapshot = captureFocusedTarget(checkbox);

    expect(snapshot).toBeNull();
  });

  it('restores a captured contenteditable target from its bounded ref', () => {
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    editable.setAttribute('aria-label', 'Reply body');
    document.body.append(editable);
    const target = captureFocusedTarget(editable)?.targetRef;

    expect(target).toBeDefined();

    const restored = restoreTargetFromRef(target!);

    expect(restored?.element).toBe(editable);
    expect(restored?.targetRef?.fingerprint).toBe(target?.fingerprint);
  });
});
