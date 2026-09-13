import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';

import { extractStage2, FEATURE_COUNT } from '../src/index';

interface GoldenCase {
  name: string;
  file: string;
  url: string;
  formAddedAfterLoad?: boolean;
  isSubFrame?: boolean;
}

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const pagesDir = join(root, 'fixtures', 'pages', 'dom');
const goldenDir = join(root, 'fixtures', 'golden', 'dom');

const cases = JSON.parse(readFileSync(join(pagesDir, 'cases.json'), 'utf8')) as GoldenCase[];
mkdirSync(goldenDir, { recursive: true });

let changed = 0;

for (const testCase of cases) {
  const html = readFileSync(join(pagesDir, testCase.file), 'utf8');
  const dom = new JSDOM(html, { url: testCase.url });
  const vector = extractStage2(testCase.url, dom.window.document, {
    formAddedAfterLoad: testCase.formAddedAfterLoad ?? false,
    isSubFrame: testCase.isSubFrame ?? false,
  });

  if (vector === null) throw new Error(`failed to extract ${testCase.name}`);
  if (vector.length !== FEATURE_COUNT) throw new Error(`bad vector length for ${testCase.name}`);

  const features = Array.from(vector, (value) => Number(value.toFixed(6)));
  const path = join(goldenDir, `${testCase.name}.json`);
  const next = `${JSON.stringify({ name: testCase.name, url: testCase.url, features }, null, 2)}\n`;

  let previous = '';
  try {
    previous = readFileSync(path, 'utf8');
  } catch {
    // No golden file yet; `previous` stays empty so the file is written below.
  }

  if (previous !== next) {
    changed += 1;
    writeFileSync(path, next);
    console.log(`updated   ${testCase.name}`);
  } else {
    console.log(`unchanged ${testCase.name}`);
  }
}

console.log(
  `\n${String(changed)} golden file(s) changed. Review the diff whenever EXTRACTOR_VERSION changes.`,
);
