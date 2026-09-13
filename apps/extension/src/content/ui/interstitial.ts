import type { Verdict } from '@sentinel/heuristics';

export interface InterstitialHandlers {
  onGoBack: () => void;
  onProceed: () => void;
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = `btn ${className}`;
  element.textContent = label;
  element.addEventListener('click', onClick);
  return element;
}

/** Makes password fields read-only and the page beneath inert. */
export function blockPage(): void {
  document.body.setAttribute('inert', '');
  for (const input of Array.from(document.querySelectorAll('input'))) {
    const type = input.getAttribute('type')?.toLowerCase() ?? '';
    const autocomplete = input.getAttribute('autocomplete')?.toLowerCase() ?? '';
    if (type === 'password' || autocomplete.includes('password')) {
      input.readOnly = true;
    }
  }
}

/** Full-page blocking overlay for HIGH verdicts, with a second confirm step. */
export function showInterstitial(
  root: ShadowRoot,
  verdict: Verdict,
  handlers: InterstitialHandlers,
): HTMLElement {
  blockPage();

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.setAttribute('data-sentinel-ui', 'interstitial');
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Phishing warning');

  const card = document.createElement('div');
  card.className = 'card';

  const headline = document.createElement('h1');
  headline.className = 'card__headline';
  headline.textContent = 'Stop — this page is probably phishing.';

  const body = document.createElement('p');
  body.className = 'card__body';
  body.textContent = verdict.reasons[0]?.humanText ?? 'This page looks suspicious.';

  const reasons = document.createElement('ul');
  reasons.className = 'card__reasons';
  for (const reason of verdict.reasons.slice(1, 3)) {
    const item = document.createElement('li');
    item.textContent = reason.humanText;
    reasons.append(item);
  }

  const actions = document.createElement('div');
  actions.className = 'card__actions';
  const goBack = button('Go back', 'btn--danger', handlers.onGoBack);
  const continueLink = document.createElement('button');
  continueLink.type = 'button';
  continueLink.className = 'card__link';
  continueLink.textContent = 'I understand the risk, continue';
  actions.append(goBack, continueLink);

  card.append(headline, body, reasons, actions);
  overlay.append(card);
  root.append(overlay);

  continueLink.addEventListener('click', () => {
    card.replaceChildren();

    const confirmHeadline = document.createElement('h1');
    confirmHeadline.className = 'card__headline';
    confirmHeadline.textContent = 'Are you sure?';

    const confirmBody = document.createElement('p');
    confirmBody.className = 'card__body';
    confirmBody.textContent = 'Passwords typed here may be stolen. Continue?';

    const confirmActions = document.createElement('div');
    confirmActions.className = 'card__actions';
    const cancel = button('Cancel', 'btn--secondary', () => {
      // Re-render the original interstitial by re-opening.
      overlay.remove();
      showInterstitial(root, verdict, handlers);
    });
    cancel.classList.add('btn--danger');
    const proceed = button('Continue anyway', 'btn--danger', handlers.onProceed);
    confirmActions.append(proceed, cancel);

    card.append(confirmHeadline, confirmBody, confirmActions);
    cancel.focus();
  });

  goBack.focus();
  return overlay;
}
