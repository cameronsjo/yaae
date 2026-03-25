import { describe, it, expect } from 'vitest';
import {
  escapeCssString,
  sanitizeColor,
  clampNumber,
  sanitizeFontFamily,
  sanitizeCssId,
} from '../src/document/css-sanitize';

describe('escapeCssString', () => {
  it('escapes double quotes', () => {
    expect(escapeCssString('Version "1.0"')).toBe('Version \\"1.0\\"');
  });

  it('escapes backslashes', () => {
    expect(escapeCssString('path\\to\\file')).toBe('path\\\\to\\\\file');
  });

  it('escapes newlines to CSS \\a sequence', () => {
    expect(escapeCssString('line1\nline2')).toBe('line1\\a line2');
  });

  it('strips carriage returns', () => {
    expect(escapeCssString('line1\r\nline2')).toBe('line1\\a line2');
  });

  it('handles combined injection attempt', () => {
    const injection = 'Acme Corp\n  }\n  * { display: none !important; }\n  .x {';
    const escaped = escapeCssString(injection);
    expect(escaped).not.toContain('\n');
    expect(escaped).toContain('\\a ');
  });

  it('passes through safe strings unchanged', () => {
    expect(escapeCssString('Hello World')).toBe('Hello World');
  });
});

describe('sanitizeColor', () => {
  it('accepts 3-digit hex', () => {
    expect(sanitizeColor('#f00', '#000')).toBe('#f00');
  });

  it('accepts 4-digit hex (with alpha)', () => {
    expect(sanitizeColor('#f00a', '#000')).toBe('#f00a');
  });

  it('accepts 6-digit hex', () => {
    expect(sanitizeColor('#c41e1e', '#000')).toBe('#c41e1e');
  });

  it('accepts 8-digit hex (with alpha)', () => {
    expect(sanitizeColor('#c41e1eff', '#000')).toBe('#c41e1eff');
  });

  it('rejects named colors', () => {
    expect(sanitizeColor('red', '#000')).toBe('#000');
  });

  it('rejects rgb() values', () => {
    expect(sanitizeColor('rgb(255,0,0)', '#000')).toBe('#000');
  });

  it('rejects injection via semicolon', () => {
    expect(sanitizeColor('red; content: "pwned"; color', '#000')).toBe('#000');
  });

  it('rejects empty string', () => {
    expect(sanitizeColor('', '#000')).toBe('#000');
  });
});

describe('clampNumber', () => {
  it('passes through in-range numbers', () => {
    expect(clampNumber(11, 6, 72, 11)).toBe(11);
  });

  it('clamps below minimum', () => {
    expect(clampNumber(2, 6, 72, 11)).toBe(6);
  });

  it('clamps above maximum', () => {
    expect(clampNumber(100, 6, 72, 11)).toBe(72);
  });

  it('coerces string to number', () => {
    expect(clampNumber('14', 6, 72, 11)).toBe(14);
  });

  it('returns fallback for NaN', () => {
    expect(clampNumber(NaN, 6, 72, 11)).toBe(11);
  });

  it('returns fallback for non-numeric string', () => {
    expect(clampNumber('not-a-number', 6, 72, 11)).toBe(11);
  });

  it('returns fallback for Infinity', () => {
    expect(clampNumber(Infinity, 6, 72, 11)).toBe(11);
  });

  it('returns fallback for undefined', () => {
    expect(clampNumber(undefined, 6, 72, 11)).toBe(11);
  });
});

describe('sanitizeFontFamily', () => {
  it('wraps a simple font name in quotes', () => {
    expect(sanitizeFontFamily('Inter')).toBe('"Inter"');
  });

  it('wraps a comma-separated list in quotes', () => {
    expect(sanitizeFontFamily('Inter, sans-serif')).toBe('"Inter, sans-serif"');
  });

  it('escapes internal double quotes', () => {
    expect(sanitizeFontFamily('My "Custom" Font')).toBe('"My \\"Custom\\" Font"');
  });

  it('escapes backslashes', () => {
    expect(sanitizeFontFamily('path\\font')).toBe('"path\\\\font"');
  });

  it('neutralizes CSS injection via semicolons', () => {
    const result = sanitizeFontFamily('Arial; } * { color: red } .x {');
    expect(result).toBe('"Arial; } * { color: red } .x {"');
    // The quotes prevent the semicolons/braces from being parsed as CSS
  });
});

describe('sanitizeCssId', () => {
  it('accepts alphanumeric with hyphens', () => {
    expect(sanitizeCssId('my-class-123')).toBe('my-class-123');
  });

  it('accepts underscores', () => {
    expect(sanitizeCssId('my_class')).toBe('my_class');
  });

  it('rejects spaces', () => {
    expect(sanitizeCssId('has space')).toBeNull();
  });

  it('rejects dots', () => {
    expect(sanitizeCssId('has.dot')).toBeNull();
  });

  it('rejects CSS selector injection', () => {
    expect(sanitizeCssId('evil } * { display:none')).toBeNull();
  });

  it('rejects empty string', () => {
    expect(sanitizeCssId('')).toBeNull();
  });

  it('rejects slashes', () => {
    expect(sanitizeCssId('path/to')).toBeNull();
  });
});
