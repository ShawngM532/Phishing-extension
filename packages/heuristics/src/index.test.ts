import { describe, expect, it } from 'vitest';

import { PACKAGE_NAME, placeholder } from './index';

describe('heuristics package placeholder', () => {
  it('exposes its package name', () => {
    expect(PACKAGE_NAME).toBe('@sentinel/heuristics');
    expect(placeholder()).toBe(PACKAGE_NAME);
  });
});
