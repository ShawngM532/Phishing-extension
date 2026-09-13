import { describe, expect, it } from 'vitest';

import { isIpHost, parseUrl } from './parse';

describe('parseUrl', () => {
  it.each([
    {
      name: 'plain https',
      input: 'https://example.com/',
      hostname: 'example.com',
      etld1: 'example.com',
      subdomains: [],
      isIp: false,
      isPunycode: false,
      port: '',
    },
    {
      name: 'http with path and query',
      input: 'http://example.com/login?next=%2Fhome&x=1',
      hostname: 'example.com',
      etld1: 'example.com',
      subdomains: [],
      isIp: false,
      isPunycode: false,
      port: '',
    },
    {
      name: 'www subdomain',
      input: 'https://www.example.com/',
      hostname: 'www.example.com',
      etld1: 'example.com',
      subdomains: ['www'],
      isIp: false,
      isPunycode: false,
      port: '',
    },
    {
      name: 'deep subdomains',
      input: 'https://a.b.c.example.co.uk/x',
      hostname: 'a.b.c.example.co.uk',
      etld1: 'example.co.uk',
      subdomains: ['a', 'b', 'c'],
      isIp: false,
      isPunycode: false,
      port: '',
    },
    {
      name: 'trailing dot is stripped',
      input: 'https://example.com./',
      hostname: 'example.com',
      etld1: 'example.com',
      subdomains: [],
      isIp: false,
      isPunycode: false,
      port: '',
    },
    {
      name: 'uppercase host is lowercased',
      input: 'https://EXAMPLE.COM/Path',
      hostname: 'example.com',
      etld1: 'example.com',
      subdomains: [],
      isIp: false,
      isPunycode: false,
      port: '',
    },
    {
      name: 'userinfo at-sign',
      input: 'https://user:pass@example.com/',
      hostname: 'example.com',
      etld1: 'example.com',
      subdomains: [],
      isIp: false,
      isPunycode: false,
      port: '',
    },
    {
      name: 'nonstandard port',
      input: 'https://example.com:8443/',
      hostname: 'example.com',
      etld1: 'example.com',
      subdomains: [],
      isIp: false,
      isPunycode: false,
      port: '8443',
    },
    {
      name: 'default port is dropped',
      input: 'https://example.com:443/',
      hostname: 'example.com',
      etld1: 'example.com',
      subdomains: [],
      isIp: false,
      isPunycode: false,
      port: '',
    },
    {
      name: 'ipv4 literal',
      input: 'http://192.168.0.1/login',
      hostname: '192.168.0.1',
      etld1: '192.168.0.1',
      subdomains: [],
      isIp: true,
      isPunycode: false,
      port: '',
    },
    {
      name: 'ipv6 literal',
      input: 'http://[::1]:8080/',
      hostname: '[::1]',
      etld1: '[::1]',
      subdomains: [],
      isIp: true,
      isPunycode: false,
      port: '8080',
    },
    {
      name: 'idn becomes punycode',
      input: 'https://bücher.de/',
      hostname: 'xn--bcher-kva.de',
      etld1: 'xn--bcher-kva.de',
      subdomains: [],
      isIp: false,
      isPunycode: true,
      port: '',
    },
    {
      name: 'private suffix is treated as its own etld+1',
      input: 'https://user.github.io/',
      hostname: 'user.github.io',
      etld1: 'user.github.io',
      subdomains: [],
      isIp: false,
      isPunycode: false,
      port: '',
    },
    {
      name: 'nz second-level suffix',
      input: 'https://login.bank.co.nz/',
      hostname: 'login.bank.co.nz',
      etld1: 'bank.co.nz',
      subdomains: ['login'],
      isIp: false,
      isPunycode: false,
      port: '',
    },
  ])('parses $name', (testCase) => {
    const parts = parseUrl(testCase.input);
    expect(parts).not.toBeNull();
    expect(parts?.hostname).toBe(testCase.hostname);
    expect(parts?.etld1).toBe(testCase.etld1);
    expect(parts?.subdomainLabels).toEqual(testCase.subdomains);
    expect(parts?.isIp).toBe(testCase.isIp);
    expect(parts?.isPunycode).toBe(testCase.isPunycode);
    expect(parts?.port).toBe(testCase.port);
  });

  it.each([
    'about:blank',
    'chrome://extensions',
    'chrome-extension://abc/page.html',
    'file:///C:/secret.html',
    'data:text/html,<h1>hi</h1>',
    'blob:https://example.com/abc',
    'javascript:alert(1)',
    'ftp://example.com/file',
    'not a url',
    '',
    'https://',
  ])('returns null for unscorable input %j', (input) => {
    expect(parseUrl(input)).toBeNull();
  });

  it('returns null when the host is empty', () => {
    expect(parseUrl('https://.../')).toBeNull();
  });

  it('exposes the public suffix', () => {
    expect(parseUrl('https://a.b.example.co.uk/')?.publicSuffix).toBe('co.uk');
    expect(parseUrl('https://example.com/')?.publicSuffix).toBe('com');
  });
});

describe('isIpHost', () => {
  it.each([
    ['127.0.0.1', true],
    ['192.168.0.1', true],
    ['255.255.255.255', true],
    ['256.1.1.1', false],
    ['1.2.3', false],
    ['[::1]', true],
    ['[2001:db8::1]', true],
    ['example.com', false],
    ['[not-an-ip]', false],
  ])('isIpHost(%j) === %s', (host, expected) => {
    expect(isIpHost(host)).toBe(expected);
  });
});
