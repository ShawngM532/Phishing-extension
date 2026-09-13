import { createInterface } from 'node:readline';

import { JSDOM } from 'jsdom';

import { extractStage1, extractStage2 } from '../src/extract';

interface InputRecord {
  url?: unknown;
  html?: unknown;
}

/**
 * Reads JSONL `{url, html}` on stdin and writes JSONL `{url, features, warnings}` on stdout.
 * This is the bridge the Python pipeline uses to guarantee one feature implementation.
 */
async function main(): Promise<void> {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    let record: InputRecord;
    try {
      record = JSON.parse(trimmed) as InputRecord;
    } catch {
      process.stdout.write(`${JSON.stringify({ error: 'invalid json' })}\n`);
      continue;
    }

    const url = typeof record.url === 'string' ? record.url : '';
    const html = typeof record.html === 'string' ? record.html : '';
    const warnings: string[] = [];

    let vector: Float32Array | null;
    if (html.length > 0) {
      const dom = new JSDOM(html, { url });
      vector = extractStage2(url, dom.window.document, { warnings });
    } else {
      vector = extractStage1(url, { warnings });
    }

    process.stdout.write(
      `${JSON.stringify({
        url,
        features: vector === null ? null : Array.from(vector),
        warnings,
      })}\n`,
    );
  }
}

void main();
