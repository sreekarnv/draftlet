import { describe, expect, it } from 'vitest';

import {
  appendSentenceBufferChunk,
  createSentenceBufferState,
  flushSentenceBuffer,
  sentenceBufferText,
} from '../../components/panel/sentence-buffer';

describe('sentence buffer', () => {
  it('flushes complete sentences and preserves incomplete trailing text', () => {
    let buffer = createSentenceBufferState();

    buffer = appendSentenceBufferChunk(buffer, 'Thanks for the note. I can help with');

    expect(buffer.segments).toEqual(['Thanks for the note.']);
    expect(buffer.trailingText).toBe('I can help with');
  });

  it('flushes multiple sentence boundaries from one chunk', () => {
    const buffer = appendSentenceBufferChunk(
      createSentenceBufferState(),
      'First sentence. Second sentence! Third',
    );

    expect(buffer.segments).toEqual(['First sentence.', 'Second sentence!']);
    expect(buffer.trailingText).toBe('Third');
  });

  it('preserves trailing text until final flush', () => {
    const buffer = flushSentenceBuffer(
      appendSentenceBufferChunk(createSentenceBufferState(), 'This is partial'),
    );

    expect(buffer.segments).toEqual(['This is partial']);
    expect(buffer.trailingText).toBe('');
    expect(sentenceBufferText(buffer)).toBe('This is partial');
  });
});
