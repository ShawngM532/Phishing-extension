/**
 * Reader for the bundled Tranco Bloom filter. Format is documented in
 * `pipeline/build_bloom.py`; both implementations use FNV-1a double hashing.
 */

const MAGIC = [0x54, 0x42, 0x4c, 0x4d] as const; // "TBLM"
const FORMAT_VERSION = 1;
const FNV_PRIME = 0x01000193;
const FNV_OFFSET = 0x811c9dc5;
const HEADER_BYTES = 15;

export function fnv1a(data: Uint8Array, seed: number = FNV_OFFSET): number {
  let hash = seed >>> 0;
  for (const byte of data) {
    hash = (hash ^ byte) >>> 0;
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

export interface BloomFilter {
  readonly m: number;
  readonly k: number;
  readonly hashSeed: number;
  has(value: string): boolean;
}

class TrancoBloom implements BloomFilter {
  readonly m: number;
  readonly k: number;
  readonly hashSeed: number;
  private readonly bits: Uint8Array;
  private readonly encoder = new TextEncoder();

  constructor(m: number, k: number, hashSeed: number, bits: Uint8Array) {
    this.m = m;
    this.k = k;
    this.hashSeed = hashSeed;
    this.bits = bits;
  }

  has(value: string): boolean {
    const data = this.encoder.encode(value);
    const h1 = fnv1a(data, this.hashSeed);
    const h2 = (fnv1a(data, (this.hashSeed ^ 0x9e3779b9) >>> 0) | 1) >>> 0;
    for (let i = 0; i < this.k; i += 1) {
      const index = (h1 + i * h2) % this.m;
      const byte = this.bits[index >> 3];
      if (byte === undefined || (byte & (1 << (index & 7))) === 0) return false;
    }
    return true;
  }
}

export function parseBloom(bytes: Uint8Array): BloomFilter {
  if (bytes.length < HEADER_BYTES) throw new Error('bloom: truncated header');
  for (let i = 0; i < MAGIC.length; i += 1) {
    if (bytes[i] !== MAGIC[i]) throw new Error('bloom: bad magic');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint16(4, true);
  if (version !== FORMAT_VERSION) throw new Error(`bloom: unsupported version ${String(version)}`);

  const m = view.getUint32(6, true);
  const k = view.getUint8(10);
  const hashSeed = view.getUint32(11, true);
  const expectedBytes = (m + 7) >> 3;
  const bits = bytes.subarray(HEADER_BYTES, HEADER_BYTES + expectedBytes);
  if (bits.length !== expectedBytes) throw new Error('bloom: truncated bit array');

  return new TrancoBloom(m, k, hashSeed, bits);
}
