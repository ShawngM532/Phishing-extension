/**
 * Event handlers that only react to real user input.
 *
 * Page script can synthesize `click`/`keydown` events (via `dispatchEvent` or
 * `element.click()`); those have `event.isTrusted === false`. The warning UI
 * must ignore them so a page cannot dismiss or click through the block.
 */
export function onTrustedClick(element: Element, handler: () => void): void {
  element.addEventListener('click', (event) => {
    if (!event.isTrusted) return;
    handler();
  });
}

export function isTrustedEvent(event: Event): boolean {
  return event.isTrusted;
}
