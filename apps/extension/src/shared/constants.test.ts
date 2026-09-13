import { describe, expect, it } from 'vitest';

import { EXTENSION_NAME } from './constants';

describe('constants', () => {
  it('has a product name', () => {
    expect(EXTENSION_NAME).toBe('Sentinel');
  });
});
