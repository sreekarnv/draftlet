import { logTargetEvent } from './draftlet-log';
import {
  captureFocusedTarget,
  isTargetRefLive,
  isTextInput,
  restoreTargetFromRef,
  type FocusSnapshot,
} from './focus';

export type InsertionTargetValidityReason =
  | 'no-target'
  | 'disconnected'
  | 'disabled'
  | 'readonly'
  | 'not-editable';

export interface InsertionTargetValidity {
  valid: boolean;
  reason?: InsertionTargetValidityReason;
  snapshot: FocusSnapshot | null;
}

export interface ArmCaptureOptions {
  timeoutMs?: number;
  document?: Document;
}

export interface InsertionTargetStore {
  getLiveSnapshot(): FocusSnapshot | null;
  isValidForInsertion(): InsertionTargetValidity;
  getLastSnapshot(): FocusSnapshot | null;
  rememberTriggerCapture(): FocusSnapshot | null;
  noteFocusIn(eventTarget: EventTarget | null): FocusSnapshot | null;
  notePointerDown(eventTarget: EventTarget | null): FocusSnapshot | null;
  noteInput(eventTarget: EventTarget | null): void;
  noteSelectionChange(): void;
  forget(): void;
  armCaptureForNextEditable(options?: ArmCaptureOptions): Promise<FocusSnapshot | null>;
  isArmed(): boolean;
  cancelArm(): void;
}

const DEFAULT_ARM_TIMEOUT_MS = 10000;

export function createInsertionTargetStore(): InsertionTargetStore {
  let snapshot: FocusSnapshot | null = null;
  let arm: ArmController | null = null;

  const captureFromEvent = (eventTarget: EventTarget | null): FocusSnapshot | null => {
    if (!isElement(eventTarget)) {
      return null;
    }

    return captureFocusedTarget(eventTarget);
  };

  const adoptSnapshot = (next: FocusSnapshot | null): FocusSnapshot | null => {
    if (!next) {
      return null;
    }

    snapshot = next;
    logTargetEvent('captured', describeSnapshot(next));
    return next;
  };

  return {
    getLiveSnapshot() {
      if (!snapshot) {
        return null;
      }

      if (!snapshot.element.isConnected) {
        const rebound = snapshot.targetRef ? restoreTargetFromRef(snapshot.targetRef) : null;

        if (rebound && isUsableTarget(rebound)) {
          snapshot = rebound;
          return snapshot;
        }

        snapshot = null;
        return null;
      }

      if (!isUsableTarget(snapshot)) {
        snapshot = null;
        return null;
      }

      return snapshot;
    },

    isValidForInsertion() {
      if (!snapshot) {
        return { valid: false, reason: 'no-target', snapshot: null };
      }

      if (!snapshot.element.isConnected) {
        return { valid: false, reason: 'disconnected', snapshot };
      }

      if (snapshot.element instanceof HTMLInputElement) {
        if (elementDisabled(snapshot.element)) {
          return { valid: false, reason: 'disabled', snapshot };
        }
        if (elementReadOnly(snapshot.element)) {
          return { valid: false, reason: 'readonly', snapshot };
        }
        if (!isTextInput(snapshot.element)) {
          return { valid: false, reason: 'not-editable', snapshot };
        }
      } else if (snapshot.element instanceof HTMLTextAreaElement) {
        if (elementDisabled(snapshot.element)) {
          return { valid: false, reason: 'disabled', snapshot };
        }
        if (elementReadOnly(snapshot.element)) {
          return { valid: false, reason: 'readonly', snapshot };
        }
      } else if (snapshot.element instanceof HTMLElement) {
        if (elementDisabled(snapshot.element) || elementReadOnly(snapshot.element)) {
          return { valid: false, reason: snapshot.element.getAttribute('aria-disabled') === 'true' ? 'disabled' : 'readonly', snapshot };
        }
        if (!isContentEditableHost(snapshot.element)) {
          return { valid: false, reason: 'not-editable', snapshot };
        }
      }

      return { valid: true, snapshot };
    },

    getLastSnapshot() {
      return snapshot;
    },

    rememberTriggerCapture() {
      const captured = captureFromEvent(document.activeElement);
      if (captured) {
        return adoptSnapshot(captured);
      }
      return snapshot;
    },

    noteFocusIn(eventTarget) {
      const captured = captureFromEvent(eventTarget);
      if (captured) {
        return adoptSnapshot(captured);
      }
      return snapshot;
    },

    notePointerDown(eventTarget) {
      const captured = captureFromEvent(eventTarget);
      if (captured) {
        return adoptSnapshot(captured);
      }
      return snapshot;
    },

    noteInput(eventTarget) {
      if (!isElement(eventTarget)) {
        return;
      }

      if (snapshot && snapshot.element === eventTarget) {
        refreshSnapshotFromLiveElement(snapshot);
        return;
      }

      const captured = captureFromEvent(eventTarget);
      if (captured) {
        adoptSnapshot(captured);
      }
    },

    noteSelectionChange() {
      if (snapshot && snapshot.element.isConnected) {
        refreshSnapshotFromLiveElement(snapshot);
      }
    },

    forget() {
      snapshot = null;
      if (arm) {
        arm.cancel();
        arm = null;
      }
    },

    isArmed() {
      return arm !== null;
    },

    cancelArm() {
      if (arm) {
        arm.cancel();
        arm = null;
      }
    },

    armCaptureForNextEditable(options) {
      const doc = options?.document ?? (typeof document !== 'undefined' ? document : null);
      if (!doc) {
        return Promise.resolve(null);
      }

      if (arm) {
        arm.cancel();
      }

      const controller = new ArmController({
        document: doc,
        timeoutMs: options?.timeoutMs ?? DEFAULT_ARM_TIMEOUT_MS,
        onCapture: (next) => {
          adoptSnapshot(next);
        },
      });

      arm = controller;
      controller.promise.finally(() => {
        if (arm === controller) {
          arm = null;
        }
      });
      return controller.promise;
    },
  };
}

interface ArmControllerOptions {
  document: Document;
  timeoutMs: number;
  onCapture: (snapshot: FocusSnapshot) => void;
}

class ArmController {
  private readonly document: Document;
  private readonly timeoutMs: number;
  private readonly onCapture: (snapshot: FocusSnapshot) => void;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private resolved = false;
  private resolvePromise: ((snapshot: FocusSnapshot | null) => void) | null = null;
  private readonly handleFocusIn: (event: Event) => void;
  private readonly handlePointerDown: (event: Event) => void;
  readonly promise: Promise<FocusSnapshot | null>;

  constructor(options: ArmControllerOptions) {
    this.document = options.document;
    this.timeoutMs = options.timeoutMs;
    this.onCapture = options.onCapture;

    this.handleFocusIn = (event) => this.tryCapture(event.target);
    this.handlePointerDown = (event) => this.tryCapture(event.target);
    this.promise = new Promise<FocusSnapshot | null>((resolve) => {
      this.resolvePromise = resolve;
      this.timer = setTimeout(() => this.finalize(null), this.timeoutMs);
      this.document.addEventListener('focusin', this.handleFocusIn, true);
      this.document.addEventListener('pointerdown', this.handlePointerDown, true);
    });
  }

  cancel(): void {
    if (this.resolved) {
      return;
    }
    this.finalize(null);
  }

  private tryCapture(target: EventTarget | null): void {
    if (this.resolved || !isElement(target)) {
      return;
    }

    const captured = captureFocusedTarget(target);
    if (captured && isUsableTarget(captured)) {
      this.onCapture(captured);
      this.finalize(captured);
    }
  }

  private finalize(result: FocusSnapshot | null): void {
    if (this.resolved) {
      return;
    }
    this.resolved = true;
    this.teardown();
    this.resolvePromise?.(result);
    this.resolvePromise = null;
  }

  private teardown(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.document.removeEventListener('focusin', this.handleFocusIn, true);
    this.document.removeEventListener('pointerdown', this.handlePointerDown, true);
  }
}

function isElement(value: unknown): value is Element {
  return value instanceof Element;
}

function elementDisabled(element: Element): boolean {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.disabled;
  }
  if (element instanceof HTMLElement) {
    return element.getAttribute('aria-disabled') === 'true';
  }
  return false;
}

function elementReadOnly(element: Element): boolean {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.readOnly;
  }
  if (element instanceof HTMLElement) {
    return element.getAttribute('aria-readonly') === 'true';
  }
  return false;
}

function isUsableTarget(snapshot: FocusSnapshot): boolean {
  const { element } = snapshot;

  if (element instanceof HTMLInputElement) {
    if (element.disabled || element.readOnly) {
      return false;
    }
    if (!isTextInput(element)) {
      return false;
    }
    return true;
  }

  if (element instanceof HTMLTextAreaElement) {
    return !element.disabled && !element.readOnly;
  }

  if (element instanceof HTMLElement) {
    if (element.getAttribute('aria-disabled') === 'true' || element.getAttribute('aria-readonly') === 'true') {
      return false;
    }
    return isContentEditableHost(element);
  }

  return false;
}

function isContentEditableHost(element: HTMLElement): boolean {
  if (element.isContentEditable) {
    return true;
  }

  const value = element.getAttribute('contenteditable');
  if (value === 'true' || value === 'plaintext-only') {
    return true;
  }

  const role = element.getAttribute('role');
  return role === 'textbox' || role === 'combobox';
}

function refreshSnapshotFromLiveElement(snapshot: FocusSnapshot): void {
  if (snapshot.element instanceof HTMLTextAreaElement || snapshot.element instanceof HTMLInputElement) {
    snapshot.selectionStart = snapshot.element.selectionStart;
    snapshot.selectionEnd = snapshot.element.selectionEnd;
  } else if (snapshot.element instanceof HTMLElement && isContentEditableHost(snapshot.element)) {
    snapshot.range = getSelectionRangeInside(snapshot.element);
  }
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

function describeSnapshot(snapshot: FocusSnapshot): Record<string, string | number | boolean | null | undefined> {
  const element = snapshot.element;
  const target = snapshot.targetRef;

  return {
    kind: target?.kind ?? (element instanceof HTMLTextAreaElement ? 'textarea' : element instanceof HTMLInputElement ? 'input' : 'contenteditable'),
    tagName: element.tagName.toLowerCase(),
    id: element.id || undefined,
    label: target?.label,
  };
}

export function isStoredTargetRefLive(target: FocusSnapshot | null): target is FocusSnapshot {
  if (!target?.targetRef) {
    return false;
  }

  return isTargetRefLive(target.targetRef, target);
}

export const INSERTION_TARGET_DEFAULT_ARM_TIMEOUT_MS = DEFAULT_ARM_TIMEOUT_MS;
