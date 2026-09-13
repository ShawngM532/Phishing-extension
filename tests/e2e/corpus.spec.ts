import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, tabIdForUrl, test, waitForTabState } from './fixtures';

interface CorpusCase {
  name: string;
  group: string;
  url: string;
}

const cases = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../fixtures/pages/corpus/cases.json', import.meta.url)),
    'utf8',
  ),
) as CorpusCase[];

const expected = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../fixtures/pages/corpus/expected.json', import.meta.url)),
    'utf8',
  ),
) as Record<string, string>;

for (const testCase of cases) {
  const want = expected[testCase.name];

  test(`${testCase.name} -> ${want ?? 'UNKNOWN'}`, async ({ context, extensionId }) => {
    expect(extensionId).toBeTruthy();

    const page = await context.newPage();
    await page.goto(testCase.url);

    const tabId = await tabIdForUrl(context, testCase.url);
    expect(tabId).not.toBeNull();

    const state = await waitForTabState(
      context,
      tabId ?? -1,
      (candidate) => candidate?.final?.level === want,
      8_000,
    );

    expect(state?.final?.level).toBe(want);
    await page.close();
  });
}
