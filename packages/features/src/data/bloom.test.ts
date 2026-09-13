import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { fnv1a, parseBloom } from './bloom';

interface BloomFixture {
  m: number;
  k: number;
  hash_seed: number;
  members: string[];
  non_members: string[];
}

function loadFixture(): { filter: ReturnType<typeof parseBloom>; fixture: BloomFixture } {
  const binPath = fileURLToPath(new URL('../../../../fixtures/bloom/bloom.bin', import.meta.url));
  const jsonPath = fileURLToPath(
    new URL('../../../../fixtures/bloom/bloom_fixture.json', import.meta.url),
  );
  const bytes = new Uint8Array(readFileSync(binPath));
  const fixture = JSON.parse(readFileSync(jsonPath, 'utf8')) as BloomFixture;
  return { filter: parseBloom(bytes), fixture };
}

describe('fnv1a', () => {
  it('matches known vectors', () => {
    expect(fnv1a(new TextEncoder().encode(''))).toBe(0x811c9dc5);
    expect(fnv1a(new TextEncoder().encode('a'))).toBe(0xe40c292c);
    expect(fnv1a(new TextEncoder().encode('foobar'))).toBe(0xbf9cf968);
  });
});

describe('parseBloom', () => {
  it('rejects a truncated header', () => {
    expect(() => parseBloom(new Uint8Array(4))).toThrow(/truncated header/);
  });

  it('rejects a bad magic', () => {
    const bytes = new Uint8Array(20);
    expect(() => parseBloom(bytes)).toThrow(/bad magic/);
  });

  it('rejects an unsupported version', () => {
    const bytes = new Uint8Array(20);
    bytes.set([0x54, 0x42, 0x4c, 0x4d]);
    new DataView(bytes.buffer).setUint16(4, 99, true);
    expect(() => parseBloom(bytes)).toThrow(/unsupported version/);
  });

  it('rejects a truncated bit array', () => {
    const bytes = new Uint8Array(17);
    bytes.set([0x54, 0x42, 0x4c, 0x4d]);
    const view = new DataView(bytes.buffer);
    view.setUint16(4, 1, true);
    view.setUint32(6, 800, true);
    view.setUint8(10, 3);
    view.setUint32(11, 1, true);
    expect(() => parseBloom(bytes)).toThrow(/truncated bit array/);
  });
});

describe('cross-language bloom fixture', () => {
  it('has no false negatives for known members', () => {
    const { filter, fixture } = loadFixture();
    for (const member of fixture.members) {
      expect(filter.has(member), `member ${member} should be present`).toBe(true);
    }
  });

  it('keeps false positives on non-members under 2%', () => {
    const { filter, fixture } = loadFixture();
    const hits = fixture.non_members.filter((item) => filter.has(item)).length;
    expect(hits / fixture.non_members.length).toBeLessThanOrEqual(0.02);
  });
});
