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
