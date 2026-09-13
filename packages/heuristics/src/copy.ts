import type { ScoreContext } from './types';

type HumanFn = (ctx: ScoreContext) => string;

function site(ctx: ScoreContext): string {
  return ctx.etld1 ?? 'this site';
}

function brand(ctx: ScoreContext): string {
  return ctx.brandToken ?? 'a well-known brand';
}

/**
 * Plain-English explanation per rule code. No jargon: never "entropy", "eTLD" or
 * "heuristic" (enforced by a unit test).
 */
export const COPY: Readonly<Record<string, HumanFn>> = {
  URL_IP_HOST: () => 'The web address is a raw number instead of a normal site name.',
  URL_PUNYCODE: () => 'The site name uses characters that only look like ordinary letters.',
  URL_BRAND_LOOKALIKE: (ctx) =>
    `The address looks almost exactly like ${brand(ctx)}, but it is ${site(ctx)}.`,
  URL_BRAND_LOOKALIKE_WEAK: (ctx) =>
    `The address is similar to ${brand(ctx)} but is actually ${site(ctx)}.`,
  URL_BRAND_IN_SUBDOMAIN: (ctx) =>
    `${brand(ctx)} appears in the address, but the real site is ${site(ctx)}.`,
  URL_BRAND_IN_PATH: (ctx) =>
    `${brand(ctx)} is mentioned in the link, but the real site is ${site(ctx)}.`,
  URL_SHORTENER: () => 'The link is a short link that hides where it really goes.',
  URL_MANY_KEYWORDS: () => 'The address is full of words that phishing pages tend to use.',
  URL_NOT_TRANCO: () => 'This site is not one of the most visited sites on the web.',
  URL_NO_HTTPS: () => 'The connection is not secure, so anything you type can be read.',
  URL_RISKY_TLD: () => 'The site uses an ending that is often used for scams.',
  URL_AT_SYMBOL: () => 'The address contains an "@" that can hide the real destination.',
  URL_NONSTANDARD_PORT: () => 'The site is served on an unusual port number.',
  URL_LONG_HOST: () => 'The site name is unusually long.',
  URL_MANY_SUBDOMAINS: () => 'The address has many extra parts in front of the real site name.',
  URL_ENTROPY: () => 'The site name looks randomly generated.',
  URL_HEX_PATH: () => 'The link contains random-looking code.',
  URL_EXE_EXT: () => 'The link points straight at a page file rather than a normal site page.',
  DOM_PASSWORD_EXTERNAL_ACTION: () =>
    'The login form sends your password to a different site than the one you are on.',
  DOM_PASSWORD_EMPTY_ACTION: () => 'The login form does not say where it will send your details.',
  DOM_PASSWORD_ON_HTTP: () => 'You are being asked for a password on an insecure page.',
  DOM_TITLE_BRAND_MISMATCH: (ctx) =>
    `The page title says ${brand(ctx)}, but the site is ${site(ctx)}.`,
  DOM_COPYRIGHT_BRAND_MISMATCH: (ctx) =>
    `The page claims to be ${brand(ctx)} in its footer, but the site is ${site(ctx)}.`,
  DOM_EXTERNAL_SCRIPT_RATIO: () => 'Most of the page is loaded from other websites.',
  DOM_HIDDEN_INPUTS: () => 'The form contains many hidden fields.',
  DOM_FORM_ADDED_AFTER_LOAD: () => 'A login form appeared after the page had already loaded.',
  DOM_META_REFRESH: () => 'The page automatically redirects you somewhere else.',
  DOM_MANY_IFRAMES: () => 'The page embeds many other pages inside it.',
  CONTENT_URGENCY: () => 'The page uses urgent language to pressure you.',
  CONTENT_CREDENTIAL: () => 'The page asks for passwords or other sign-in details.',
  CONTENT_FINANCIAL: () => 'The page talks about payments, bank details or money.',
  CONTENT_LANG_MISMATCH: () => 'The language of the page does not match the country of the site.',
};

export function reasonText(code: string, ctx: ScoreContext): string {
  const fn = COPY[code];
  return fn === undefined ? 'This page shows a signal that is often used in phishing.' : fn(ctx);
}
