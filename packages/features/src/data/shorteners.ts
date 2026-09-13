/**
 * URL shorteners (feature 21). Kept in sync with `shorteners.txt` by a unit test;
 * the array form is used at runtime because bundlers and the Node CLI cannot both
 * import a `.txt` file as text.
 */
export const SHORTENERS: readonly string[] = [
  'bit.ly',
  't.co',
  'tinyurl.com',
  'goo.gl',
  'ow.ly',
  'buff.ly',
  'is.gd',
  'v.gd',
  'rebrand.ly',
  'cutt.ly',
  'shorturl.at',
  'rb.gy',
  'lnkd.in',
  'youtu.be',
  'amzn.to',
  'amzn.eu',
  'ebay.to',
  't.ly',
  'short.link',
  'bit.do',
  'mcaf.ee',
  'soo.gd',
  's2r.co',
  'clicky.me',
  'budurl.com',
  'bc.vc',
  'su.pr',
  'twurl.nl',
  'snipurl.com',
  'tiny.cc',
  'url4.eu',
  'tr.im',
  'adf.ly',
  'sh.st',
  'q.gs',
  'u.to',
  'zpr.io',
  'clck.ru',
  'vk.cc',
  'db.tt',
  'goo.su',
  'x.co',
  's.id',
  'rlu.ru',
  'ht.ly',
  'dlvr.it',
  'ift.tt',
  'trib.al',
  'po.st',
  'spoti.fi',
  'apple.co',
  'wapo.st',
  'nyti.ms',
  'cnb.cx',
  'reut.rs',
];

const SHORTENER_SET = new Set(SHORTENERS);

export function isUrlShortener(etld1: string | null, hostname: string): boolean {
  if (etld1 !== null && SHORTENER_SET.has(etld1)) return true;
  return SHORTENER_SET.has(hostname);
}
