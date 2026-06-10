import type { ComposeTargetKind, ComposeTargetRef } from './types';

export interface FocusSnapshot {
  element: HTMLInputElement | HTMLTextAreaElement | HTMLElement;
  selectionStart?: number | null;
  selectionEnd?: number | null;
  range?: Range;
  targetRef?: ComposeTargetRef;
}

export function captureFocusedTarget(candidate: EventTarget | null = document.activeElement): FocusSnapshot | null {
  if (!(candidate instanceof Element)) {
    return null;
  }

  if (candidate instanceof HTMLTextAreaElement) {
    return captureTextControl(candidate);
  }

  if (candidate instanceof HTMLInputElement && isTextInput(candidate)) {
    return captureTextControl(candidate);
  }

  const editable = getContentEditableElement(candidate);

  if (editable) {
    return {
      element: editable,
      range: getSelectionRangeInside(editable),
      targetRef: createComposeTargetRef(editable),
    };
  }

  return null;
}

export function isTextInput(element: HTMLInputElement): boolean {
  const textInputTypes = new Set([
    'email',
    'number',
    'password',
    'search',
    'tel',
    'text',
    'url',
  ]);

  return textInputTypes.has(element.type || 'text');
}

function captureTextControl(element: HTMLInputElement | HTMLTextAreaElement): FocusSnapshot {
  return {
    element,
    selectionStart: element.selectionStart,
    selectionEnd: element.selectionEnd,
    targetRef: createComposeTargetRef(element),
  };
}

function getContentEditableElement(element: Element): HTMLElement | null {
  if (element instanceof HTMLElement && element.isContentEditable) {
    return element;
  }

  return element.closest<HTMLElement>('[contenteditable="true"], [contenteditable="plaintext-only"]');
}

function getSelectionRangeInside(element: HTMLElement): Range | undefined {
  const selection = element.ownerDocument.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return undefined;
  }

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const containerElement = container.nodeType === Node.ELEMENT_NODE
    ? container
    : container.parentElement;

  if (containerElement && element.contains(containerElement)) {
    return range.cloneRange();
  }

  return undefined;
}

export function restoreTargetFromRef(target: ComposeTargetRef): FocusSnapshot | null {
  if (!isSamePageTarget(target)) {
    return null;
  }

  if (!target.selector) {
    return null;
  }

  const element = document.querySelector(target.selector);

  if (!element || targetFingerprint(element) !== target.fingerprint) {
    return null;
  }

  return captureFocusedTarget(element);
}

export function isTargetRefLive(target: ComposeTargetRef, snapshot: FocusSnapshot | null): boolean {
  if (!snapshot || !isSamePageTarget(target)) {
    return false;
  }

  return snapshot.targetRef?.fingerprint === target.fingerprint;
}

function createComposeTargetRef(element: HTMLInputElement | HTMLTextAreaElement | HTMLElement): ComposeTargetRef {
  const kind = targetKind(element);
  const selector = boundedSelector(element);
  const fingerprint = targetFingerprint(element, selector);

  return {
    targetId: `${kind}:${hashString(fingerprint)}`,
    kind,
    pageUrl: window.location.href,
    origin: window.location.origin || undefined,
    pageTitle: document.title || undefined,
    selector,
    fingerprint,
    label: targetLabel(element),
    lastSeenAt: new Date().toISOString(),
  };
}

function targetKind(element: Element): ComposeTargetKind {
  if (element instanceof HTMLTextAreaElement) {
    return 'textarea';
  }

  if (element instanceof HTMLInputElement) {
    return 'input';
  }

  return 'contenteditable';
}

function targetFingerprint(element: Element, selector = boundedSelector(element)): string {
  const parts = [
    targetKind(element),
    window.location.origin,
    selector,
    element.getAttribute('name'),
    element.id,
    element.getAttribute('aria-label'),
    element.getAttribute('role'),
    element instanceof HTMLInputElement ? element.type : '',
  ];

  return parts.filter(Boolean).join('|');
}

function isSamePageTarget(target: ComposeTargetRef): boolean {
  if (target.origin && target.origin !== window.location.origin) {
    return false;
  }

  return target.pageUrl === window.location.href || target.origin === window.location.origin;
}

function targetLabel(element: Element): string | undefined {
  const label = element.getAttribute('aria-label')
    || element.getAttribute('placeholder')
    || element.getAttribute('name')
    || element.id
    || element.getAttribute('role');

  return trimBounded(label, 120);
}

function boundedSelector(element: Element): string | undefined {
  const direct = selectorFromStableAttribute(element);

  if (direct) {
    return direct;
  }

  const segments: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body && segments.length < 4) {
    segments.unshift(nthSelector(current));
    current = current.parentElement;
  }

  const selector = segments.join(' > ');
  return selector.length <= 500 ? selector : undefined;
}

function selectorFromStableAttribute(element: Element): string | undefined {
  const attributes = ['id', 'data-testid', 'data-test', 'aria-label', 'name'];

  for (const attribute of attributes) {
    const value = element.getAttribute(attribute);

    if (value) {
      return `${element.localName}[${attribute}="${cssEscape(value)}"]`;
    }
  }

  return undefined;
}

function nthSelector(element: Element): string {
  const localName = element.localName;
  const parent = element.parentElement;

  if (!parent) {
    return localName;
  }

  const siblings = Array.from(parent.children).filter((child) => child.localName === localName);
  const index = siblings.indexOf(element) + 1;
  return `${localName}:nth-of-type(${Math.max(index, 1)})`;
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, '\\$&');
}

function trimBounded(value: string | null, maxLength: number): string | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function hashString(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(36);
}
