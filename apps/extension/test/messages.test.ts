import { describe, expect, it } from 'vitest';

import { isMessage, sendMessage } from '../src/shared/messages';
import { installChromeMock } from './chrome-mock';

describe('message bus', () => {
  it('accepts known message types', () => {
    expect(isMessage({ type: 'GET_TAB_STATE', payload: {} })).toBe(true);
    expect(isMessage({ type: 'CLOSE_TAB', payload: {} })).toBe(true);
  });

  it('rejects unknown or malformed messages', () => {
    expect(isMessage({ type: 'NOPE', payload: {} })).toBe(false);
    expect(isMessage(null)).toBe(false);
    expect(isMessage('GET_TAB_STATE')).toBe(false);
    expect(isMessage({})).toBe(false);
  });

  it('rejects unknown message types at compile time', () => {
    const attempt = (): void => {
      // @ts-expect-error unknown message types must not type-check
      void sendMessage({ type: 'NOPE' });
    };
    expect(typeof attempt).toBe('function');
  });

  it('forwards messages to chrome.runtime.sendMessage', async () => {
    installChromeMock();
    await expect(sendMessage({ type: 'GET_TAB_STATE', payload: {} })).resolves.toEqual({
      state: null,
    });
  });
});
