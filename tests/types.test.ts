import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/types';

describe('Types', () => {
  it('should have default settings defined', () => {
    expect(DEFAULT_SETTINGS).toBeDefined();
    expect(typeof DEFAULT_SETTINGS).toBe('object');
  });
});
