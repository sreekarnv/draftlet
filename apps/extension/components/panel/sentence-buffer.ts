export interface SentenceBufferState {
  segments: string[];
  trailingText: string;
}

export function createSentenceBufferState(): SentenceBufferState {
  return {
    segments: [],
    trailingText: '',
  };
}

export function appendSentenceBufferChunk(
  state: SentenceBufferState,
  chunk: string,
): SentenceBufferState {
  if (!chunk) {
    return state;
  }

  let trailingText = `${state.trailingText}${chunk}`;
  const segments = [...state.segments];
  let boundary = firstSentenceBoundary(trailingText);

  while (boundary !== -1) {
    const segment = trailingText.slice(0, boundary).trim();

    if (segment) {
      segments.push(segment);
    }

    trailingText = trailingText.slice(boundary).trimStart();
    boundary = firstSentenceBoundary(trailingText);
  }

  return {
    segments,
    trailingText,
  };
}

export function flushSentenceBuffer(state: SentenceBufferState): SentenceBufferState {
  const trailingText = state.trailingText.trim();

  if (!trailingText) {
    return {
      ...state,
      trailingText: '',
    };
  }

  return {
    segments: [...state.segments, trailingText],
    trailingText: '',
  };
}

export function sentenceBufferText(state: SentenceBufferState): string {
  return [...state.segments, state.trailingText.trim()].filter(Boolean).join(' ');
}

function firstSentenceBoundary(text: string): number {
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char !== '.' && char !== '!' && char !== '?') {
      continue;
    }

    let end = index + 1;

    while (end < text.length && /["')\]]/.test(text[end])) {
      end += 1;
    }

    if (end === text.length || /\s/.test(text[end])) {
      return end;
    }
  }

  return -1;
}
