/**
 * Scoring bridge for the Python evaluation pipeline.
 *
 * Reads JSONL `{url, html}` on stdin and writes JSONL
 * `{url, features, stage1, stage2, final}` on stdout.
 *
 * It deliberately reuses the *shipping* heuristic engine and merge logic from the
 * extension (`apps/extension/src/background/{engine,scoring}.ts`) so that offline
 * evaluation measures exactly what the browser runs. Feature extraction comes from
 * the one shared implementation (`packages/features`).
 *
 * Usage:
 *   echo '{"url":"https://x/login","html":"<html>…</html>"}' | pnpm score
 */
import { createInterface } from 'node:readline';

import { JSDOM } from 'jsdom';

import { heuristicEngine } from '../apps/extension/src/background/engine';
import { mergeVerdicts, scoreFeatures } from '../apps/extension/src/background/scoring';
import { DEFAULT_SETTINGS } from '../apps/extension/src/background/settings';
import { extractStage1, extractStage2 } from '../packages/features/src/extract';

interface InputRecord {
  url?: unknown;
  html?: unknown;
}

interface StageScore {
  score: number;
  level: string;
  reasons: { code: string; weight: number }[];
}

function toStageScore(verdict: {
  score: number;
  level: string;
  reasons: { code: string; weight: number }[];
}): StageScore {
  return {
    score: verdict.score,
    level: verdict.level,
    reasons: verdict.reasons.map((reason) => ({ code: reason.code, weight: reason.weight })),
  };
}

function scoreOne(url: string, html: string): Record<string, unknown> {
  const warnings: string[] = [];

  const stage1Features = extractStage1(url, { warnings });
  if (stage1Features === null) {
    return { url, error: 'unscorable url', warnings };
  }
  const stage1 = scoreFeatures(heuristicEngine, url, stage1Features, DEFAULT_SETTINGS);

  if (html.length === 0) {
    return {
      url,
      features: Array.from(stage1Features),
      stage1: toStageScore(stage1),
      stage2: null,
      final: toStageScore(stage1),
      warnings,
    };
  }

  const dom = new JSDOM(html, { url: url === '' ? 'about:blank' : url });
  const stage2Features = extractStage2(url, dom.window.document, {
    warnings,
    formAddedAfterLoad: false,
    isSubFrame: false,
  });
  if (stage2Features === null) {
    return { url, error: 'extraction failed', warnings };
  }
  const stage2 = scoreFeatures(heuristicEngine, url, stage2Features, DEFAULT_SETTINGS);
  const final = mergeVerdicts(stage1, stage2) ?? stage2;

  return {
    url,
    features: Array.from(stage2Features),
    stage1: toStageScore(stage1),
    stage2: toStageScore(stage2),
    final: toStageScore(final),
    warnings,
  };
}

async function main(): Promise<void> {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });

  for await (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') continue;

    let record: InputRecord;
    try {
      record = JSON.parse(trimmed) as InputRecord;
    } catch {
      process.stdout.write(`${JSON.stringify({ error: 'invalid json' })}\n`);
      continue;
    }

    const url = typeof record.url === 'string' ? record.url : '';
    const html = typeof record.html === 'string' ? record.html : '';

    try {
      process.stdout.write(`${JSON.stringify(scoreOne(url, html))}\n`);
    } catch (error) {
      process.stdout.write(
        `${JSON.stringify({
          url,
          error: error instanceof Error ? error.message : String(error),
        })}\n`,
      );
    }
  }
}

void main();
