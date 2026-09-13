import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';

import { heuristicEngine } from '../apps/extension/src/background/engine';
import { mergeVerdicts, scoreFeatures } from '../apps/extension/src/background/scoring';
import { DEFAULT_SETTINGS } from '../apps/extension/src/background/settings';
import { extractStage1, extractStage2 } from '../packages/features/src/extract';

interface CorpusCase {
  name: string;
  group: string;
  file: string;
  url: string;
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const corpusDir = join(root, 'fixtures', 'pages', 'corpus');
const cases = JSON.parse(readFileSync(join(corpusDir, 'cases.json'), 'utf8')) as CorpusCase[];

const expected: Record<string, string> = {};

/**
 * jsdom does not execute page scripts, so fixtures whose signals only appear at runtime
 * are overridden with the verdict observed in a real browser (see tests/e2e/corpus.spec.ts).
 * edge-late-form injects a password form after 1s, which then trips DOM_PASSWORD_ON_HTTP.
 */
const OVERRIDES: Record<string, string> = {
  'edge-late-form': 'HIGH',
};

for (const testCase of cases) {
  const html = readFileSync(join(corpusDir, testCase.file), 'utf8');
  const dom = new JSDOM(html, { url: testCase.url });

  const stage1Features = extractStage1(testCase.url);
  const stage1 =
    stage1Features === null
      ? null
      : scoreFeatures(heuristicEngine, testCase.url, stage1Features, DEFAULT_SETTINGS);

  const stage2Features = extractStage2(testCase.url, dom.window.document, {
    isSubFrame: false,
    formAddedAfterLoad: false,
  });
  const stage2 =
    stage2Features === null
      ? null
      : scoreFeatures(heuristicEngine, testCase.url, stage2Features, DEFAULT_SETTINGS);

  const final = mergeVerdicts(stage1, stage2);
  expected[testCase.name] = OVERRIDES[testCase.name] ?? final?.level ?? 'UNKNOWN';
}

writeFileSync(join(corpusDir, 'expected.json'), `${JSON.stringify(expected, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(expected, null, 2));
