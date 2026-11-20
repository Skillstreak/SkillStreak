import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { UiCounterKey } from './entities/ui-click-count.entity';

/**
 * docs/adr/0039-anonymous-ui-click-statistics.md Decision 4 — the server's
 * `UiCounterKey` enum is the authority, and the app's literal copy must
 * match it exactly, in both directions.
 *
 * Lives in the backend suite on purpose: `Backend lint, build, test` is a
 * required check and every mobile check is advisory. A key the app sends
 * but the server lacks is a 400 that silently drops every upload (exactly
 * what PRs #142/#143 did with `screen.home` vs `screen_home`); a key the
 * server accepts but the app lacks is vocabulary nobody reviewed a call
 * site for.
 *
 * Reads the file from the checkout. If it has moved, this fails rather
 * than skips: a parity test that passes by seeing nothing is worse than
 * none.
 */
const APP_KEY_FILE = join(
  __dirname,
  '..',
  '..',
  '..',
  'mobile',
  'src',
  'api',
  'uiCounterKeys.ts',
);

function appKeys(): string[] {
  const source = readFileSync(APP_KEY_FILE, 'utf8');
  const array = /export const UI_COUNTER_KEYS = \[([\s\S]*?)\] as const;/.exec(
    source,
  );
  if (!array) {
    throw new Error(`UI_COUNTER_KEYS array not found in ${APP_KEY_FILE}`);
  }
  // Every non-blank, non-comment line inside the array must be exactly one
  // quoted key, so nothing (a spread, a computed key) can slip past.
  return array[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('//'))
    .map((line) => {
      const match = /^'([a-z0-9_]+)',?$/.exec(line);
      if (!match)
        throw new Error(`Unexpected line in UI_COUNTER_KEYS: ${line}`);
      return match[1];
    });
}

describe('UiCounterKey parity with the app (ADR-0039 Decision 4)', () => {
  const server = Object.values(UiCounterKey) as string[];

  it('the app list is found and non-empty', () => {
    expect(appKeys().length).toBeGreaterThan(0);
  });

  it('has no duplicates on either side', () => {
    expect(new Set(appKeys()).size).toBe(appKeys().length);
    expect(new Set(server).size).toBe(server.length);
  });

  it('every app key exists on the server', () => {
    expect(appKeys().filter((k) => !server.includes(k))).toEqual([]);
  });

  it('every server key exists in the app', () => {
    const app = appKeys();
    expect(server.filter((k) => !app.includes(k))).toEqual([]);
  });

  it('every key is screen_<name> or btn_<name> in snake_case', () => {
    for (const key of server) {
      expect(key).toMatch(/^(screen|btn)_[a-z]+(?:_[a-z]+)*$/);
    }
  });

  it('fits in one upload (the server caps a batch at 20 keys)', () => {
    expect(server.length).toBeLessThanOrEqual(20);
  });
});
