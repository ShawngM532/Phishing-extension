import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearTabState,
  getTabState,
  patchTabState,
  setTabState,
} from '../src/background/tab-state';
import { createTabState } from '../src/shared/types';
import { installChromeMock } from './chrome-mock';

describe('tab-state store', () => {
  let session: ReturnType<typeof installChromeMock>['session'];

  beforeEach(() => {
    ({ session } = installChromeMock());
  });

  it('returns null when no state is stored', async () => {
    await expect(getTabState(1)).resolves.toBeNull();
  });

  it('sets and gets state', async () => {
    const state = createTabState(7, 'https://example.com', 1);
    await setTabState(state);
    await expect(getTabState(7)).resolves.toEqual(state);
    expect(session.store.get('tab:7')).toEqual(state);
  });

  it('patches existing state and preserves identity fields', async () => {
    await setTabState(createTabState(3, 'https://example.com', 1));
    const patched = await patchTabState(3, { proceeded: true, dismissed: true });
    expect(patched).toMatchObject({
      tabId: 3,
      url: 'https://example.com',
      proceeded: true,
      dismissed: true,
    });
  });

  it('returns null when patching unknown state', async () => {
    await expect(patchTabState(99, { proceeded: true })).resolves.toBeNull();
  });

  it('clears state', async () => {
    await setTabState(createTabState(5, 'https://example.com', 1));
    await clearTabState(5);
    await expect(getTabState(5)).resolves.toBeNull();
  });

  it('ignores corrupt stored values', async () => {
    session.store.set('tab:8', { nope: true });
    await expect(getTabState(8)).resolves.toBeNull();
  });
});
