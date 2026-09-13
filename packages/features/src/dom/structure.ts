import { brandEtld1s, findBrandToken } from '../url/brand';
import { parseUrl } from '../url/parse';
import { FEATURE_INDEX } from '../version';

export interface DomContext {
  /** URL of the frame being scored. */
  pageUrl: string;
  /** True when a form or password field was added after initial load (mutation observer). */
  formAddedAfterLoad: boolean;
  /** True when this document is a sub-frame. */
  isSubFrame: boolean;
}

const MAX_DOM_NODES = 20_000;

// Numeric NodeFilter constants so this works under jsdom/Node where the global is absent.
const SHOW_ALL = 0xffffffff;
const SHOW_TEXT = 4;

function resolveUrl(raw: string, baseURI: string): string {
  try {
    return new URL(raw, baseURI).href;
  } catch {
    return raw;
  }
}

function isPasswordInput(input: Element): boolean {
  const type = input.getAttribute('type')?.toLowerCase() ?? 'text';
  const autocomplete = input.getAttribute('autocomplete')?.toLowerCase() ?? '';
  return type === 'password' || autocomplete.includes('password');
}

function passwordInputs(doc: Document): Element[] {
  return Array.from(doc.querySelectorAll('input')).filter(isPasswordInput);
}

function countDomNodes(doc: Document): number {
  const root = doc.documentElement as Element | null;
  if (root === null) return 0;
  const walker = doc.createTreeWalker(root, SHOW_ALL);
  let count = 1;
  while (count < MAX_DOM_NODES && walker.nextNode() !== null) {
    count += 1;
  }
  return count;
}

function isExternal(href: string | null, pageEtld1: string | null, baseURI: string): boolean {
  if (href === null || href === '') return false;
  const parsed = parseUrl(resolveUrl(href, baseURI));
  return parsed !== null && parsed.etld1 !== null && parsed.etld1 !== pageEtld1;
}

function externalRatio(
  elements: readonly Element[],
  pageEtld1: string | null,
  baseURI: string,
  getHref: (element: Element) => string | null,
): number {
  if (elements.length === 0) return 0;
  const external = elements.filter((element) => isExternal(getHref(element), pageEtld1, baseURI));
  return external.length / elements.length;
}

function footerText(doc: Document): string {
  const parts: string[] = [];
  for (const element of doc.querySelectorAll('footer, [class*="footer" i], [id*="footer" i]')) {
    parts.push(element.textContent);
  }

  const body = doc.body as HTMLElement | null;
  if (body !== null) {
    const walker = doc.createTreeWalker(body, SHOW_TEXT);
    let node = walker.nextNode();
    while (node !== null) {
      const text = node.textContent ?? '';
      if (text.includes('©') || /copyright/i.test(text)) parts.push(text);
      node = walker.nextNode();
    }
  }

  return parts.join(' ');
}

/** Writes DOM structure features (PRD §10.2 indices 27–46) into `out`. */
export function writeDomFeatures(out: Float32Array, doc: Document, ctx: DomContext): void {
  const page = parseUrl(ctx.pageUrl);
  const pageEtld1 = page?.etld1 ?? null;
  const baseURI = doc.baseURI;

  const forms = doc.querySelectorAll('form');
  const passwords = passwordInputs(doc);
  const scripts = Array.from(doc.querySelectorAll('script[src]'));
  const anchors = Array.from(doc.querySelectorAll('a[href]'));
  const iframes = doc.querySelectorAll('iframe');

  out[FEATURE_INDEX.num_forms] = forms.length;
  out[FEATURE_INDEX.has_password_input] = passwords.length > 0 ? 1 : 0;
  out[FEATURE_INDEX.num_external_scripts] = scripts.filter((script) =>
    isExternal(script.getAttribute('src'), pageEtld1, baseURI),
  ).length;
  out[FEATURE_INDEX.external_script_ratio] = externalRatio(scripts, pageEtld1, baseURI, (element) =>
    element.getAttribute('src'),
  );
  out[FEATURE_INDEX.num_iframes] = iframes.length;
  out[FEATURE_INDEX.num_hidden_inputs] = doc.querySelectorAll('input[type="hidden" i]').length;
  out[FEATURE_INDEX.num_anchors] = anchors.length;
  out[FEATURE_INDEX.external_anchor_ratio] = externalRatio(anchors, pageEtld1, baseURI, (element) =>
    element.getAttribute('href'),
  );

  const nullAnchors = anchors.filter((anchor) => {
    const href = (anchor.getAttribute('href') ?? '').trim().toLowerCase();
    return href === '' || href === '#' || href.startsWith('javascript:');
  }).length;
  out[FEATURE_INDEX.anchor_null_ratio] = anchors.length === 0 ? 0 : nullAnchors / anchors.length;

  const favicon = doc.querySelector('link[rel~="icon" i]');
  out[FEATURE_INDEX.favicon_external] = isExternal(
    favicon?.getAttribute('href') ?? null,
    pageEtld1,
    baseURI,
  )
    ? 1
    : 0;

  out[FEATURE_INDEX.has_meta_refresh] =
    doc.querySelector('meta[http-equiv="refresh" i]') !== null ? 1 : 0;

  const titleToken = findBrandToken(doc.title);
  out[FEATURE_INDEX.title_brand_mismatch] =
    titleToken !== null && !brandEtld1s(titleToken).includes(pageEtld1 ?? '') ? 1 : 0;

  const copyToken = findBrandToken(footerText(doc));
  out[FEATURE_INDEX.copyright_brand_mismatch] =
    copyToken !== null && !brandEtld1s(copyToken).includes(pageEtld1 ?? '') ? 1 : 0;

  const onHttp = page?.protocol === 'http:';
  out[FEATURE_INDEX.login_form_on_http] = passwords.length > 0 && onHttp ? 1 : 0;
  out[FEATURE_INDEX.dom_node_count] = countDomNodes(doc);
  out[FEATURE_INDEX.form_added_after_load] = ctx.formAddedAfterLoad ? 1 : 0;
  out[FEATURE_INDEX.password_field_in_iframe] = passwords.length > 0 && ctx.isSubFrame ? 1 : 0;
  out[FEATURE_INDEX.num_onsubmit_handlers] = doc.querySelectorAll('[onsubmit]').length;

  if (passwords.length > 0) {
    const first = passwords[0];
    const form = first?.closest('form') ?? null;
    const rawAction = (form?.getAttribute('action') ?? '').trim();
    const emptyOrJs =
      rawAction === '' || rawAction === '#' || rawAction.toLowerCase().startsWith('javascript:');

    out[FEATURE_INDEX.password_form_action_empty_or_js] = emptyOrJs ? 1 : 0;
    if (!emptyOrJs) {
      const resolved = parseUrl(resolveUrl(rawAction, baseURI));
      out[FEATURE_INDEX.password_form_action_external] =
        resolved !== null && resolved.etld1 !== null && resolved.etld1 !== pageEtld1 ? 1 : 0;
    }
  }
}
