import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from './fixtures';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(HERE, '..', '..', 'apps', 'extension', 'dist', 'manifest.json');

interface WarEntry {
  resources: string[];
  use_dynamic_url?: boolean;
}

test('the built manifest exposes only the loader chunks, never source maps', async ({
  extensionId,
}) => {
  expect(extensionId).toBeTruthy();

  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as {
    web_accessible_resources?: WarEntry[];
  };

  expect(manifest.web_accessible_resources?.length).toBeGreaterThan(0);
  for (const entry of manifest.web_accessible_resources ?? []) {
    expect(entry.resources.length).toBeGreaterThan(0);
    expect(entry.resources.every((resource) => resource.endsWith('.js'))).toBe(true);
    // crxjs's loader resolves the static path, so use_dynamic_url must stay off
    // (ADR #7). This assertion guards against someone re-enabling it.
    expect(entry.use_dynamic_url ?? false).toBe(false);
  }
});
