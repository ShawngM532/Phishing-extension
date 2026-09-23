import { blockPage } from './ui/interstitial';

export interface TamperGuardOptions {
  /** True while the page must stay blocked (HIGH and not proceeded). */
  shouldBlock: () => boolean;
  /** Re-renders the overlay if the page removed it. Called after re-blocking. */
  ensureBlocked: () => void;
}

const OBSERVE_OPTIONS: MutationObserverInit = {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['inert', 'readonly', 'autocomplete'],
};

function passwordInputs(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll('input[type="password"]'));
}

/**
 * True when the page has removed part of the block we need to restore. Keeping
 * this cheap-and-read-only means ordinary page churn does not trigger DOM writes.
 */
function needsReassert(): boolean {
  if (!document.body.hasAttribute('inert')) return true;
  for (const input of passwordInputs()) {
    if (!input.readOnly) return true;
    if (input.getAttribute('autocomplete') !== 'off') return true;
  }
  return false;
}

/**
 * While a HIGH verdict is active and not proceeded, re-applies `inert`,
 * `readonly` and `autocomplete="off"` (and the overlay) whenever page script
 * tries to remove them or injects new password inputs.
 */
export function installTamperGuard(options: TamperGuardOptions): void {
  let observer: MutationObserver | null = null;
  let scheduled = false;

  const reassert = (): void => {
    if (!options.shouldBlock()) return;
    observer?.disconnect();
    try {
      blockPage();
      options.ensureBlocked();
    } finally {
      observer?.observe(document.documentElement, OBSERVE_OPTIONS);
    }
  };

  observer = new MutationObserver(() => {
    if (scheduled || !options.shouldBlock() || !needsReassert()) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (options.shouldBlock() && needsReassert()) reassert();
    });
  });
  observer.observe(document.documentElement, OBSERVE_OPTIONS);
}
