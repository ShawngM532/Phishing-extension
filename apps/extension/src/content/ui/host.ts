import { UI_STYLES } from './styles';

const HOST_TAG = 'sentinel-root';

let hostElement: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let reattachObserver: MutationObserver | null = null;

function watchReattach(): void {
  if (reattachObserver !== null) return;
  reattachObserver = new MutationObserver(() => {
    if (hostElement !== null && !document.documentElement.contains(hostElement)) {
      document.documentElement.append(hostElement);
    }
  });
  reattachObserver.observe(document.documentElement, { childList: true });
}

/**
 * Returns the closed shadow root, creating (and re-attaching) the host as needed.
 * The root is closed so page script cannot reach the warning UI; tests drive it
 * through the isolated-world E2E bridge (see `content/e2e-bridge.ts`).
 */
export function getShadowRoot(): ShadowRoot {
  if (
    hostElement !== null &&
    shadowRoot !== null &&
    document.documentElement.contains(hostElement)
  ) {
    return shadowRoot;
  }

  hostElement?.remove();
  hostElement = document.createElement(HOST_TAG);
  hostElement.setAttribute('data-sentinel', 'host');
  shadowRoot = hostElement.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = UI_STYLES;
  shadowRoot.append(style);

  document.documentElement.append(hostElement);
  watchReattach();
  return shadowRoot;
}

/** Removes any rendered UI and restores the page (un-inerts the body). */
export function clearUi(): void {
  if (shadowRoot !== null) {
    for (const node of Array.from(shadowRoot.querySelectorAll('[data-sentinel-ui]'))) {
      node.remove();
    }
  }
  document.body.removeAttribute('inert');
  for (const input of Array.from(document.querySelectorAll('input[type="password"]'))) {
    (input as HTMLInputElement).readOnly = false;
  }
}
