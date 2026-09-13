import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import { extractStage2 } from '../extract';
import { FEATURE_COUNT } from '../version';

interface GoldenCase {
  name: string;
  file: string;
  url: string;
  formAddedAfterLoad?: boolean;
  isSubFrame?: boolean;
}

interface GoldenFile {
  name: string;
  url: string;
  features: number[];
}

const cases = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../../fixtures/pages/dom/cases.json', import.meta.url)),
    'utf8',
  ),
) as GoldenCase[];

function readFixture(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('DOM golden vectors', () => {
  it.each(cases)('matches golden for $name', (testCase) => {
    const html = readFixture(`../../../../fixtures/pages/dom/${testCase.file}`);
    const dom = new JSDOM(html, { url: testCase.url });

    const vector = extractStage2(testCase.url, dom.window.document, {
      formAddedAfterLoad: testCase.formAddedAfterLoad ?? false,
      isSubFrame: testCase.isSubFrame ?? false,
    });

    expect(vector).not.toBeNull();
    expect(vector?.length).toBe(FEATURE_COUNT);

    const golden = JSON.parse(
      readFixture(`../../../../fixtures/golden/dom/${testCase.name}.json`),
    ) as GoldenFile;

    expect(golden.name).toBe(testCase.name);
    expect(Array.from(vector ?? [], (value) => Number(value.toFixed(6)))).toEqual(golden.features);
  });
});
