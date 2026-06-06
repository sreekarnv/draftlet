interface FloatingButtonOptions {
  onClick: () => void;
}

const OFFSET = 8;
const BASE_SHADOW = '0 8px 24px rgba(15, 23, 42, 0.12), 0 1px 2px rgba(15, 23, 42, 0.08)';
const ACTIVE_SHADOW = '0 12px 30px rgba(15, 23, 42, 0.16), 0 0 0 3px rgba(59, 130, 246, 0.12)';

export function createFloatingButton({ onClick }: FloatingButtonOptions) {
  const button = document.createElement('button');
  const iconWrap = document.createElement('span');
  const icon = createSparklesIcon();
  const label = document.createElement('span');

  button.type = 'button';
  button.setAttribute('aria-label', 'Open Draftlet');
  button.style.cssText = [
    'position: fixed',
    'z-index: 2147483647',
    'display: none',
    'align-items: center',
    'gap: 6px',
    'height: 29px',
    'padding: 0 10px 0 7px',
    'border: 1px solid rgba(203, 213, 225, 0.92)',
    'border-radius: 999px',
    'background: linear-gradient(180deg, #ffffff 0%, #f8fafc 72%, #eef2f7 100%)',
    'color: #1e293b',
    `box-shadow: ${BASE_SHADOW}`,
    'font: 650 12px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'letter-spacing: 0',
    'cursor: pointer',
    'white-space: nowrap',
    'outline: none',
    'will-change: transform',
    'transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease, background 140ms ease',
  ].join(';');

  iconWrap.dataset.draftletTriggerIcon = 'true';
  iconWrap.style.cssText = [
    'display: inline-flex',
    'align-items: center',
    'justify-content: center',
    'width: 17px',
    'height: 17px',
    'border-radius: 999px',
    'background: #eff6ff',
    'color: #2563eb',
    'box-shadow: inset 0 0 0 1px rgba(147, 197, 253, 0.58)',
    'transition: background 140ms ease, color 140ms ease, box-shadow 140ms ease',
  ].join(';');

  label.textContent = 'Draftlet';
  label.style.cssText = 'display: inline-block; transform: translateY(-0.5px);';

  iconWrap.append(icon);
  button.append(iconWrap, label);

  button.addEventListener('mousedown', (event) => {
    event.preventDefault();
  });

  button.addEventListener('mouseenter', () => setActiveStyle(button));
  button.addEventListener('mouseleave', () => setBaseStyle(button));
  button.addEventListener('focus', () => setActiveStyle(button));
  button.addEventListener('blur', () => setBaseStyle(button));

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });

  document.documentElement.append(button);

  return {
    element: button,
    show(rect: DOMRect) {
      button.style.display = 'inline-flex';

      const top = Math.max(OFFSET, rect.bottom + OFFSET);
      const left = Math.min(
        window.innerWidth - button.offsetWidth - OFFSET,
        Math.max(OFFSET, rect.left),
      );

      button.style.top = `${top}px`;
      button.style.left = `${left}px`;
    },
    hide() {
      button.style.display = 'none';
      setBaseStyle(button);
    },
    remove() {
      button.remove();
    },
  };
}

function createSparklesIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.style.cssText = 'display: block; flex: 0 0 auto;';

  for (const pathData of [
    'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z',
    'M20 3v4',
    'M22 5h-4',
    'M4 17v2',
    'M5 18H3',
  ]) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    svg.append(path);
  }

  return svg;
}

function setActiveStyle(button: HTMLButtonElement) {
  const icon = getIconWrap(button);

  button.style.borderColor = 'rgba(148, 163, 184, 0.9)';
  button.style.boxShadow = ACTIVE_SHADOW;
  button.style.background = 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)';
  button.style.color = '#0f172a';
  button.style.transform = 'translateY(-1px)';

  if (icon) {
    icon.style.background = '#dbeafe';
    icon.style.color = '#1d4ed8';
    icon.style.boxShadow = 'inset 0 0 0 1px rgba(96, 165, 250, 0.7)';
  }
}

function setBaseStyle(button: HTMLButtonElement) {
  const icon = getIconWrap(button);

  button.style.borderColor = 'rgba(203, 213, 225, 0.92)';
  button.style.boxShadow = BASE_SHADOW;
  button.style.background = 'linear-gradient(180deg, #ffffff 0%, #f8fafc 72%, #eef2f7 100%)';
  button.style.color = '#1e293b';
  button.style.transform = 'translateY(0)';

  if (icon) {
    icon.style.background = '#eff6ff';
    icon.style.color = '#2563eb';
    icon.style.boxShadow = 'inset 0 0 0 1px rgba(147, 197, 253, 0.58)';
  }
}

function getIconWrap(button: HTMLButtonElement) {
  return button.querySelector<HTMLElement>('[data-draftlet-trigger-icon="true"]');
}
