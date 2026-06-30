export function isCommandSurfaceShortcut(event: Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'key' | 'metaKey' | 'repeat' | 'shiftKey'>): boolean {
  return event.ctrlKey
    && event.shiftKey
    && !event.altKey
    && !event.metaKey
    && !event.repeat
    && event.key.toLowerCase() === 'd';
}
