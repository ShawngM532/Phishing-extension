import { beforeEach, describe, expect, it } from 'vitest';

import { clearBadge, setBadge } from '../src/background/badge';
import { installChromeMock, type ChromeMockHandle } from './chrome-mock';

describe('badge controller', () => {
  let handle: ChromeMockHandle;

  beforeEach(() => {
    handle = installChromeMock();
  });

  it.each([
    ['LOW', 'green', ''],
    ['MEDIUM', 'amber', '!'],
    ['HIGH', 'red', '!'],
    ['UNKNOWN', 'grey', '!'],
  ] as const)('sets the %s badge to %s with text %j', async (level, color, text) => {
    await setBadge(42, level);

    expect(handle.action.setIcon).toHaveBeenCalledWith({
      tabId: 42,
      path: {
        16: `icons/${color}-16.png`,
        32: `icons/${color}-32.png`,
        48: `icons/${color}-48.png`,
        128: `icons/${color}-128.png`,
      },
    });
    expect(handle.action.setBadgeText).toHaveBeenCalledWith({ tabId: 42, text });
  });

  it('clears the badge to grey', async () => {
    await clearBadge(9);
    expect(handle.action.setBadgeText).toHaveBeenCalledWith({ tabId: 9, text: '' });
    expect(handle.action.setIcon).toHaveBeenCalledWith({
      tabId: 9,
      path: {
        16: 'icons/grey-16.png',
        32: 'icons/grey-32.png',
        48: 'icons/grey-48.png',
        128: 'icons/grey-128.png',
      },
    });
  });
});
