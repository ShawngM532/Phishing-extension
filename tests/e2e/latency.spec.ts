import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, tabIdForUrl, test, waitForTabState } from './fixtures';

interface CorpusCase {
  name: string;
  url: string;
}

const cases = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../fixtures/pages/corpus/cases.json', import.meta.url)),
    'utf8',
  ),
) as CorpusCase[];

function percentile(values: readonly number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((q / 100) * sorted.length))] ?? 0;
}

test('latency over the corpus stays within budget', async ({ context, extensionId }) => {
  expect(extensionId).toBeTruthy();

  const stage1: number[] = [];
  const stage2: number[] = [];

  for (const testCase of cases) {
    const page = await context.newPage();
    await page.goto(testCase.url);
    const tabId = await tabIdForUrl(context, testCase.url);
    const state = await waitForTabState(context, tabId ?? -1, (s) => s?.stage2 != null, 8_000);

    if (state?.timings?.stage1Ms !== undefined) stage1.push(state.timings.stage1Ms);
    if (state?.timings?.stage2Ms !== undefined) stage2.push(state.timings.stage2Ms);
    await page.close();
  }

  const summary = {
    stage1: { p50: percentile(stage1, 50), p95: percentile(stage1, 95), n: stage1.length },
    stage2: { p50: percentile(stage2, 50), p95: percentile(stage2, 95), n: stage2.length },
  };
  console.log(`LATENCY ${JSON.stringify(summary)}`);

  expect(summary.stage1.n).toBeGreaterThan(0);
  expect(summary.stage1.p95).toBeLessThanOrEqual(50);
  expect(summary.stage2.p95).toBeLessThanOrEqual(400);
});
