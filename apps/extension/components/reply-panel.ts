import panelStyles from './panel/panel.css?inline';
import { DEFAULT_PANEL_VIEW, DEFAULT_TONE } from '../core/constants';
import type { ConnectionStatus, InsertionResult, PanelState, PanelView, StreamedReply, Tone } from '../core/types';
import { mountDraftletPanel, type PanelController } from '../ui/mount-panel';

interface ReplyPanelOptions {
  initialTone?: Tone;
  initialView?: PanelView;
  onToneChange?: (tone: Tone) => void;
  onViewChange?: (activeView: PanelView) => void;
  onGenerate: () => void;
  onInsert: (replyText: string) => Promise<InsertionResult>;
  onClose?: () => void;
}

interface OpenOptions {
  selectedText: string;
  tone?: Tone;
  activeView?: PanelView;
}

const PANEL_WIDTH = 340;
const OFFSET = 12;

export function createReplyPanel({
  initialTone = DEFAULT_TONE,
  initialView = DEFAULT_PANEL_VIEW,
  onToneChange,
  onViewChange,
  onGenerate,
  onInsert,
  onClose,
}: ReplyPanelOptions) {
  const host = document.createElement('draftlet-reply-panel');
  const shadow = host.attachShadow({ mode: 'open' });
  const mountPoint = document.createElement('div');
  let anchorRect: DOMRect | null = null;
  let closePanel = () => {};

  host.style.cssText = [
    'position: fixed',
    'z-index: 2147483647',
    'display: none',
    `width: ${PANEL_WIDTH}px`,
  ].join(';');

  shadow.append(createStyles(), mountPoint);
  document.documentElement.append(host);

  const mountedPanel = mountDraftletPanel(mountPoint, {
    initialTone,
    initialView,
    onToneChange,
    onViewChange,
    onGenerate,
    onInsert,
    onCloseRequest() {
      closePanel();
    },
    onAfterRender() {
      if (host.style.display !== 'none' && anchorRect) {
        positionPanel(host, anchorRect);
        host.style.visibility = '';
      }
    },
  });
  const controller: PanelController = mountedPanel.controller;

  const api = {
    element: host,
    open(rect: DOMRect, options: OpenOptions) {
      anchorRect = rect;
      host.style.display = 'block';
      host.style.visibility = 'hidden';
      controller.open(options);
    },
    close() {
      host.style.display = 'none';
      onClose?.();
    },
    setTone(tone: Tone) {
      controller.setTone(tone);
    },
    getTone() {
      return controller.getTone();
    },
    setActiveView(activeView: PanelView) {
      controller.setActiveView(activeView);
    },
    getActiveView() {
      return controller.getActiveView();
    },
    setConnectionStatus(status: ConnectionStatus) {
      controller.setConnectionStatus(status);
    },
    setState(state: PanelState, message = '') {
      controller.setState(state, message);
    },
    clearReplies() {
      controller.clearReplies();
    },
    addReply(reply: StreamedReply) {
      controller.addReply(reply);
    },
    contains(target: EventTarget | null) {
      return target instanceof Node && host.contains(target);
    },
    remove() {
      mountedPanel.unmount();
      host.remove();
    },
  };

  closePanel = api.close;
  return api;
}

function createStyles() {
  const style = document.createElement('style');
  style.textContent = panelStyles;
  return style;
}

function positionPanel(host: HTMLElement, rect: DOMRect) {
  const panelRect = host.getBoundingClientRect();
  const panelWidth = Math.min(panelRect.width || PANEL_WIDTH, window.innerWidth - OFFSET * 2);
  const panelHeight = Math.min(panelRect.height || 0, window.innerHeight - OFFSET * 2);
  const spaceBelow = window.innerHeight - rect.bottom - OFFSET;
  const spaceAbove = rect.top - OFFSET;
  const belowTop = rect.bottom + OFFSET;
  const aboveTop = rect.top - panelHeight - OFFSET;
  const preferredTop = spaceBelow >= panelHeight
    ? belowTop
    : spaceAbove >= panelHeight
      ? aboveTop
      : spaceBelow >= spaceAbove
        ? belowTop
        : aboveTop;
  const top = clamp(preferredTop, OFFSET, window.innerHeight - panelHeight - OFFSET);
  const left = Math.min(
    window.innerWidth - panelWidth - OFFSET,
    Math.max(OFFSET, rect.left),
  );

  host.style.top = `${top}px`;
  host.style.left = `${left}px`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
