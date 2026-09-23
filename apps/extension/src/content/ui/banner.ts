import type { Verdict } from '@sentinel/heuristics';

import { isTrustedEvent, onTrustedClick } from './trusted';

export interface BannerHandlers {
  onDismiss: () => void;
  onAllowlist: () => void;
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = `btn ${className}`;
  element.textContent = label;
  onTrustedClick(element, onClick);
  return element;
}

/** Non-blocking amber banner for MEDIUM verdicts. */
export function showBanner(
  root: ShadowRoot,
  verdict: Verdict,
  handlers: BannerHandlers,
): HTMLElement {
  const banner = document.createElement('div');
  banner.className = 'banner';
  banner.setAttribute('data-sentinel-ui', 'banner');
  banner.setAttribute('role', 'alertdialog');
  banner.setAttribute('aria-label', 'Suspicious page warning');

  const text = document.createElement('div');
  text.className = 'banner__text';

  const lead = document.createElement('div');
  lead.textContent = verdict.reasons[0]?.humanText ?? 'This page looks suspicious.';
  text.append(lead);

  const chips = document.createElement('div');
  chips.className = 'banner__chips';
  for (const reason of verdict.reasons.slice(1, 4)) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = reason.humanText;
    chips.append(chip);
  }
  text.append(chips);

  const actions = document.createElement('div');
  actions.className = 'banner__actions';
  const allow = button('This site is safe', 'btn--primary', handlers.onAllowlist);
  const dismiss = button('Dismiss', 'btn--secondary', handlers.onDismiss);
  actions.append(allow, dismiss);

  banner.append(text, actions);
  banner.addEventListener('keydown', (event) => {
    if (!isTrustedEvent(event)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      handlers.onDismiss();
    }
  });

  root.append(banner);
  allow.focus();
  return banner;
}
