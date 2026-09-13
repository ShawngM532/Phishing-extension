export interface SubmitGuardOptions {
  shouldBlock: () => boolean;
  onBlocked: () => void;
}

function isPasswordField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLInputElement)) return false;
  const type = target.getAttribute('type')?.toLowerCase() ?? '';
  const autocomplete = target.getAttribute('autocomplete')?.toLowerCase() ?? '';
  return type === 'password' || autocomplete.includes('password');
}

/**
 * Blocks form submission (capture phase) and Enter in password fields while a HIGH
 * verdict is active and the user has not proceeded.
 */
export function installSubmitGuard(options: SubmitGuardOptions): void {
  window.addEventListener(
    'submit',
    (event) => {
      if (!options.shouldBlock()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      options.onBlocked();
    },
    true,
  );

  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Enter' || !options.shouldBlock() || !isPasswordField(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      options.onBlocked();
    },
    true,
  );
}
