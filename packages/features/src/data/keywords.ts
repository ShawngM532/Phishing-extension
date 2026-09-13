/** Keyword lists for URL and page-content signals (PRD §10.1 feature 22, §10.3 features 47–49). */

export const PHISH_URL_KEYWORDS: readonly string[] = [
  'login',
  'log-in',
  'signin',
  'sign-in',
  'verify',
  'verification',
  'secure',
  'security',
  'account',
  'update',
  'confirm',
  'wallet',
  'invoice',
  'suspended',
  'password',
  'credential',
  'billing',
  'payment',
  'auth',
  'authenticate',
  'session',
  'unlock',
  'alert',
  'recovery',
  'reset',
  'webscr',
  'cmd',
  'ebayisapi',
  'appleid',
  'icloud',
  'office365',
  'onedrive',
  'sharepoint',
  'outlook',
  'webmail',
  'support',
  'customer',
  'validation',
  'authentication',
  'l0gin',
  'secur3',
  'acc0unt',
  'upd4te',
  'verif1cation',
  'passw0rd',
];

export const URGENCY_TERMS: readonly string[] = [
  'verify now',
  'verify your account',
  'suspended',
  'within 24 hours',
  'within 48 hours',
  'unusual activity',
  'unusual sign-in',
  'immediate action',
  'act now',
  'limited time',
  'expires',
  'final notice',
  'final warning',
  'account will be closed',
  'confirm immediately',
  'security alert',
  'unauthorized',
  'locked',
  'restricted',
  'failure to',
  'last warning',
  'avoid suspension',
  'time sensitive',
  'respond immediately',
  'action required',
  'click here',
  'update now',
  'validate now',
  'suspicious activity',
  'unrecognized device',
  'payment failed',
  'declined',
  'overdue',
  'immediately',
  'as soon as possible',
  'urgent',
  'important notice',
  'your attention is required',
  'do not ignore',
  'will be deactivated',
];

export const CREDENTIAL_TERMS: readonly string[] = [
  'password',
  'passw0rd',
  'pin',
  'one-time code',
  'one time code',
  'otp',
  'security question',
  'username',
  'user id',
  'login',
  'sign in',
  'passcode',
  'verification code',
  '2fa',
  'two-factor',
  'mfa',
  'secret question',
  "mother's maiden name",
  'date of birth',
  'social security',
  'ssn',
  'account number',
  'card number',
  'cvv',
  'cvc',
  'expiry',
  'sort code',
  'routing number',
  'tax file number',
  'ird number',
  'access code',
  'recovery phrase',
  'seed phrase',
  'private key',
  're-enter password',
  'current password',
];

export const FINANCIAL_TERMS: readonly string[] = [
  'bank',
  'card',
  'payment',
  'invoice',
  'refund',
  'transfer',
  'wire',
  'billing',
  'credit',
  'debit',
  'balance',
  'statement',
  'transaction',
  'deposit',
  'withdrawal',
  'loan',
  'mortgage',
  'tax',
  'irs',
  'ird',
  'ato',
  'payroll',
  'salary',
  'remittance',
  'beneficiary',
  'iban',
  'swift',
  'bpay',
  'polipay',
  'direct debit',
  'overdue',
  'outstanding',
  'amount due',
  'purchase',
  'subscription',
  'charge',
];

const URL_KEYWORD_SET = PHISH_URL_KEYWORDS.map((keyword) => keyword.toLowerCase());

export function countUrlKeywords(url: string): number {
  const lower = url.toLowerCase();
  let count = 0;
  for (const keyword of URL_KEYWORD_SET) {
    if (lower.includes(keyword)) count += 1;
  }
  return count;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word-boundary aware matcher, precompiled per term. */
function compileTextMatchers(terms: readonly string[]): readonly RegExp[] {
  return terms.map(
    (term) => new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(term)}(?:[^a-z0-9]|$)`, 'i'),
  );
}

const URGENCY_MATCHERS = compileTextMatchers(URGENCY_TERMS);
const CREDENTIAL_MATCHERS = compileTextMatchers(CREDENTIAL_TERMS);
const FINANCIAL_MATCHERS = compileTextMatchers(FINANCIAL_TERMS);

function countMatchers(text: string, matchers: readonly RegExp[]): number {
  let count = 0;
  for (const matcher of matchers) {
    if (matcher.test(text)) count += 1;
  }
  return count;
}

export function countUrgencyTerms(text: string): number {
  return countMatchers(text, URGENCY_MATCHERS);
}

export function countCredentialTerms(text: string): number {
  return countMatchers(text, CREDENTIAL_MATCHERS);
}

export function countFinancialTerms(text: string): number {
  return countMatchers(text, FINANCIAL_MATCHERS);
}
