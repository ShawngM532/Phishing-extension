export interface SubmitGuardOptions {
  shouldBlock: () => boolean;
  onBlocked: () => void;
}

/**
 * Credential fields whose input must never happen while a HIGH block is active:
 * password inputs, plus the autofill/one-time-code/credit-card autocomplete
 * tokens that the feature extractor also treats as credentials.
 */
export function isCredentialField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLInputElement)) return false;
  const type = target.getAttribute('type')?.toLowerCase() ?? '';
  if (type === 'password') return true;
  const autocomplete = target.getAttribute('autocomplete')?.toLowerCase() ?? '';
  return (
    autocomplete === 'current-password' ||
    autocomplete === 'new-password' ||
    autocomplete === 'one-time-code' ||
    autocomplete.startsWith('cc-')
  );
}

/**
 * Guarantee hierarchy while a HIGH verdict is active and the user has not proceeded:
 *
 * 1. The primary guarantee is that **typing into credential fields is
 *    impossible** — the fields are `readonly`, the page is `inert`, and this
 *    guard cancels `keydown`/`paste`/`beforeinput` in the capture phase on
 *    `document` for any credential field.
 * 2. Submit-blocking is **best-effort on top of that**, because page script can
 *    exfiltrate with `fetch()` without ever submitting a form.
 */
export function installSubmitGuard(options: SubmitGuardOptions): void {
  const blockCredentialInput = (event: Event): void => {
    if (!options.shouldBlock() || !isCredentialField(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    options.onBlocked();
  };

  document.addEventListener('keydown', blockCredentialInput, true);
  document.addEventListener('paste', blockCredentialInput, true);
  document.addEventListener('beforeinput', blockCredentialInput, true);

  document.addEventListener(
    'submit',
    (event) => {
      if (!options.shouldBlock()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      options.onBlocked();
    },
    true,
  );
}
