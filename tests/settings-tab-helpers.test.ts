import { describe, it, expect } from 'vitest';
import {
  isValidClassificationId,
  sanitizeClassificationId,
} from '../src/document/settings-tab-helpers';

describe('sanitizeClassificationId', () => {
  it('lowercases input', () => {
    expect(sanitizeClassificationId('NON-Sensitive')).toBe('non-sensitive');
  });

  it('replaces whitespace runs with hyphens', () => {
    expect(sanitizeClassificationId('non sensitive')).toBe('non-sensitive');
    expect(sanitizeClassificationId('non   sensitive')).toBe('non-sensitive');
  });

  it('strips disallowed characters', () => {
    expect(sanitizeClassificationId('non!@#sensitive')).toBe('nonsensitive');
  });

  it('produces a hyphen for whitespace-only input (documenting the F3 bug surface)', () => {
    // The sanitizer collapses any run of whitespace into a single hyphen
    // via `\s+`. The result is non-empty — passing the prior truthy save
    // guard `if (entry.id)` and persisting `id: '-'`. isValidClassificationId
    // is what protects us going forward.
    expect(sanitizeClassificationId('   ')).toBe('-');
  });

  it('produces empty string for input with no allowed chars', () => {
    expect(sanitizeClassificationId('!@#$%')).toBe('');
  });
});

describe('isValidClassificationId (F3 save guard)', () => {
  it('rejects an empty string', () => {
    expect(isValidClassificationId('')).toBe(false);
  });

  it('rejects a string of hyphens (whitespace-only sanitized)', () => {
    expect(isValidClassificationId('-')).toBe(false);
    expect(isValidClassificationId('---')).toBe(false);
  });

  it('accepts an ID with at least one alphanumeric char', () => {
    expect(isValidClassificationId('a')).toBe(true);
    expect(isValidClassificationId('non-sensitive')).toBe(true);
    expect(isValidClassificationId('-x-')).toBe(true);
    expect(isValidClassificationId('1')).toBe(true);
  });

  it('end-to-end: whitespace-only input is sanitized then rejected', () => {
    const sanitized = sanitizeClassificationId('   ');
    expect(sanitized).toBe('-');
    expect(isValidClassificationId(sanitized)).toBe(false);
  });

  it('end-to-end: legitimate input is sanitized then accepted', () => {
    const sanitized = sanitizeClassificationId('Non Sensitive');
    expect(sanitized).toBe('non-sensitive');
    expect(isValidClassificationId(sanitized)).toBe(true);
  });
});
