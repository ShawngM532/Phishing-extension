import { parse as tldtsParse } from 'tldts';

export interface UrlParts {
  href: string;
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  /** eTLD+1, or the literal host for IP addresses. Null only if the host is unparsable. */
  etld1: string | null;
  /** Public suffix (e.g. `co.uk`), or null when the host is unparsable. */
  publicSuffix: string | null;
  /** Labels to the left of the eTLD+1, outermost first. */
  subdomainLabels: readonly string[];
  isIp: boolean;
  isPunycode: boolean;
}

/** Schemes that are never scored (browser-internal, local files, inline data). */
const UNSCORABLE_PROTOCOLS = new Set([
  'about:',
  'chrome:',
  'chrome-extension:',
  'edge:',
  'brave:',
  'file:',
  'data:',
  'blob:',
  'javascript:',
  'view-source:',
]);

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const IPV6 = /^[0-9a-f:.]*:[0-9a-f:.]*$/i;

export function isIpHost(hostname: string): boolean {
  const bare =
    hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

  if (IPV4.test(bare)) {
    return bare.split('.').every((part) => Number(part) <= 255);
  }
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return IPV6.test(bare);
  }
  return false;
}

export function parseUrl(input: string): UrlParts | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (UNSCORABLE_PROTOCOLS.has(url.protocol)) return null;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const hostname = url.hostname.toLowerCase().replace(/\.+$/, '');
  if (hostname === '') return null;

  const isIp = isIpHost(hostname);
  const parsed = tldtsParse(hostname, { allowPrivateDomains: true });
  const etld1 = isIp ? hostname : (parsed.domain ?? null);
  const publicSuffix = isIp ? null : (parsed.publicSuffix ?? null);
  const subdomain = isIp ? '' : (parsed.subdomain ?? '');
  const subdomainLabels = subdomain === '' ? [] : subdomain.split('.');

  return {
    href: url.href,
    protocol: url.protocol,
    hostname,
    port: url.port,
    pathname: url.pathname,
    search: url.search,
    etld1,
    publicSuffix,
    subdomainLabels,
    isIp,
    isPunycode: hostname.includes('xn--'),
  };
}
