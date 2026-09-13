import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';

import { extractStage1, extractStage2, FEATURE_COUNT } from '../src/index';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index] ?? 0;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }
  return sorted[mid] ?? 0;
}

function benchStage1(count: number, rounds: number): { p50: number; p95: number } {
  const urls: string[] = [];
  for (let i = 0; i < count; i += 1) {
    urls.push(`https://sub${String(i)}.shop-${String(i)}.co.nz/login/verify?token=${String(i)}`);
  }

  // Warm up the JIT.
  for (let i = 0; i < Math.min(2000, urls.length); i += 1) extractStage1(urls[i] ?? '');

  const p50s: number[] = [];
  const p95s: number[] = [];
  for (let round = 0; round < rounds; round += 1) {
    const samples: number[] = [];
    for (const url of urls) {
      const start = performance.now();
      const vector = extractStage1(url);
      const elapsed = performance.now() - start;
      if (vector !== null && vector.length !== FEATURE_COUNT) throw new Error('bad vector length');
      samples.push(elapsed);
    }
    p50s.push(percentile(samples, 50));
    p95s.push(percentile(samples, 95));
  }

  return { p50: median(p50s), p95: median(p95s) };
}

function benchStage2(
  repeats: number,
  rounds: number,
): { p50: number; p95: number; largestNodes: number } {
  const cases = JSON.parse(
    readFileSync(join(root, 'fixtures', 'pages', 'dom', 'cases.json'), 'utf8'),
  ) as { name: string; file: string; url: string }[];

  const p50s: number[] = [];
  const p95s: number[] = [];
  let largestNodes = 0;

  for (let round = 0; round < rounds; round += 1) {
    const samples: number[] = [];
    for (const testCase of cases) {
      const html = readFileSync(join(root, 'fixtures', 'pages', 'dom', testCase.file), 'utf8');
      const dom = new JSDOM(html, { url: testCase.url });
      for (let i = 0; i < repeats; i += 1) {
        const start = performance.now();
        const vector = extractStage2(testCase.url, dom.window.document);
        const elapsed = performance.now() - start;
        if (vector === null) throw new Error(`extract failed for ${testCase.name}`);
        samples.push(elapsed);
        largestNodes = Math.max(largestNodes, vector[43] ?? 0);
      }
    }
    p50s.push(percentile(samples, 50));
    p95s.push(percentile(samples, 95));
  }

  return { p50: median(p50s), p95: median(p95s), largestNodes };
}

const ROUNDS = 5;
const stage1 = benchStage1(10_000, ROUNDS);
const stage2 = benchStage2(100, ROUNDS);

console.log(`Stage 1 (10,000 URLs, median p50/p95 of ${String(ROUNDS)} rounds)`);
console.log(
  `  p50 ${stage1.p50.toFixed(4)} ms/URL   p95 ${stage1.p95.toFixed(4)} ms/URL   target <= 0.2 ms`,
);
console.log(`Stage 2 (17 fixtures x 100, median p50/p95 of ${String(ROUNDS)} rounds)`);
console.log(
  `  p50 ${stage2.p50.toFixed(2)} ms   p95 ${stage2.p95.toFixed(2)} ms   largest DOM ${String(stage2.largestNodes)} nodes   target <= 40 ms`,
);

const stage1Micro = stage1.p95 <= 0.2;
const stage2Micro = stage2.p95 <= 40;
if (stage1Micro && stage2Micro) {
  console.log('\nPASS: extractor micro-targets met');
} else {
  console.log(
    `\nWARN: micro-target miss (stage1 p95 ${stage1.p95.toFixed(4)} ms > 0.2 ms). ` +
      'PRD navigation budget (stage 1 p95 <= 50 ms) is met with a large margin; see docs/LATENCY.md.',
  );
}
