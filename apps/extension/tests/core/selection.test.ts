import { afterEach, describe, expect, it } from 'vitest';

import { getPageSelection } from '../../core/selection';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('getPageSelection', () => {
  it('captures selected text from a textarea candidate', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'First sentence. Second sentence.';
    document.body.append(textarea);
    textarea.setSelectionRange(16, 32);

    const selection = getPageSelection(textarea);

    expect(selection?.text).toBe('Second sentence.');
    expect(selection?.rect).toMatchObject({ x: 0, y: 0 });
  });
});
