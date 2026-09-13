import { describe, expect, it } from 'vitest';

import { PACKAGE_NAME, placeholder } from './index';

describe('features package placeholder', () => {
  it('exposes its package name', () => {
    expect(PACKAGE_NAME).toBe('@sentinel/features');
    expect(placeholder()).toBe(PACKAGE_NAME);
  });
});
