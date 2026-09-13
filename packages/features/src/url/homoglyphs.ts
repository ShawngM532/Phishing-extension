/** Character-level homoglyph folding used to spot brand spoofing. */
const CHAR_MAP: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'l',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
  $: 's',
  // Common Cyrillic/Greek lookalikes (lowercase forms; input is lowercased first).
  а: 'a',
  е: 'e',
  о: 'o',
  р: 'p',
  с: 'c',
  х: 'x',
  у: 'y',
  ѕ: 's',
  ј: 'j',
  і: 'i',
  ԁ: 'd',
  ν: 'v',
  ı: 'i',
};

/** Multi-character sequences that collapse to a single letter when folded. */
const SEQUENCE_MAP: readonly (readonly [string, string])[] = [
  ['rn', 'm'],
  ['vv', 'w'],
  ['cl', 'd'],
  ['ii', 'n'],
  ['nn', 'm'],
];

export function foldHomoglyphs(input: string): string {
  const lower = input.toLowerCase();
  let mapped = '';
  for (const char of lower) {
    mapped += CHAR_MAP[char] ?? char;
  }
  let result = mapped;
  for (const [from, to] of SEQUENCE_MAP) {
    result = result.split(from).join(to);
  }
  return result;
}

/** Reused across calls; extraction is synchronous so there is no re-entrancy. */
let SCRATCH = new Int32Array(0);

/** Optimal string alignment (restricted Damerau-Levenshtein) distance. */
export function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const width = n + 1;
  const needed = (m + 1) * width;
  if (SCRATCH.length < needed) SCRATCH = new Int32Array(needed);
  const d = SCRATCH;
  const cell = (row: number, col: number): number => d[row * width + col] ?? 0;

  for (let i = 0; i <= m; i += 1) d[i * width] = i;
  for (let j = 0; j <= n; j += 1) d[j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      let best = Math.min(cell(i - 1, j) + 1, cell(i, j - 1) + 1, cell(i - 1, j - 1) + cost);
      if (
        i > 1 &&
        j > 1 &&
        a.charCodeAt(i - 1) === b.charCodeAt(j - 2) &&
        a.charCodeAt(i - 2) === b.charCodeAt(j - 1)
      ) {
        best = Math.min(best, cell(i - 2, j - 2) + 1);
      }
      d[i * width + j] = best;
    }
  }

  return cell(m, n);
}

export function normalizedDistance(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return damerauLevenshtein(a, b) / maxLen;
}
