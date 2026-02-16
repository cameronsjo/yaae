import { describe, it, expect } from 'vitest';
import {
  findSentenceBounds,
  findParagraphBounds,
} from '../src/cm6/sentence-detection';

describe('findParagraphBounds', () => {
  it('returns full text when no blank lines', () => {
    const text = 'Hello world. This is a test.';
    expect(findParagraphBounds(text, 5)).toEqual({ from: 0, to: text.length });
  });

  it('finds paragraph bounded by blank lines', () => {
    const text = 'First para.\n\nSecond para.\n\nThird para.';
    // Cursor in "Second para." — starts at index 13, ends at 25
    const result = findParagraphBounds(text, 15);
    expect(result.from).toBe(13);
    expect(result.to).toBe(25);
  });

  it('finds first paragraph before any blank line', () => {
    const text = 'First para.\n\nSecond para.';
    const result = findParagraphBounds(text, 3);
    expect(result.from).toBe(0);
    expect(result.to).toBe(11);
  });

  it('finds last paragraph after final blank line', () => {
    const text = 'First para.\n\nSecond para.';
    const result = findParagraphBounds(text, 20);
    expect(result.from).toBe(13);
    expect(result.to).toBe(text.length);
  });

  it('cursor inside second paragraph', () => {
    const text = 'First.\n\nSecond.';
    // Cursor at index 8 is 'S' in "Second."
    const result = findParagraphBounds(text, 8);
    expect(result.from).toBe(8);
    expect(result.to).toBe(text.length);
  });
});

describe('findSentenceBounds', () => {
  it('finds a simple sentence', () => {
    const text = 'Hello world.';
    const result = findSentenceBounds(text, 3);
    expect(result).toEqual({ from: 0, to: 12 });
  });

  it('finds the second of two sentences', () => {
    const text = 'First sentence. Second sentence.';
    const result = findSentenceBounds(text, 20);
    expect(result.from).toBe(16);
    expect(result.to).toBe(32);
  });

  it('finds the first of two sentences', () => {
    const text = 'First sentence. Second sentence.';
    const result = findSentenceBounds(text, 5);
    expect(result.from).toBe(0);
    expect(result.to).toBe(15);
  });

  it('handles exclamation marks', () => {
    const text = 'Wow! That is great.';
    const result = findSentenceBounds(text, 1);
    expect(result.from).toBe(0);
    expect(result.to).toBe(4);
  });

  it('handles question marks', () => {
    const text = 'Is this working? Yes it is.';
    const result = findSentenceBounds(text, 5);
    expect(result.from).toBe(0);
    expect(result.to).toBe(16);
  });

  it('skips abbreviation Dr.', () => {
    const text = 'Dr. Smith went to the store.';
    const result = findSentenceBounds(text, 10);
    expect(result).toEqual({ from: 0, to: 28 });
  });

  it('skips abbreviation Mr.', () => {
    const text = 'Talk to Mr. Jones please.';
    const result = findSentenceBounds(text, 15);
    expect(result).toEqual({ from: 0, to: 25 });
  });

  it('skips abbreviation Mrs.', () => {
    const text = 'Mrs. Smith is here.';
    const result = findSentenceBounds(text, 10);
    expect(result).toEqual({ from: 0, to: 19 });
  });

  it('skips abbreviation e.g.', () => {
    const text = 'Use a tool, e.g. a hammer.';
    const result = findSentenceBounds(text, 20);
    expect(result).toEqual({ from: 0, to: 26 });
  });

  it('skips abbreviation i.e.', () => {
    const text = 'The best one, i.e. the first.';
    const result = findSentenceBounds(text, 22);
    expect(result).toEqual({ from: 0, to: 29 });
  });

  it('handles multi-line paragraph as single sentence', () => {
    const text = 'This sentence\nspans multiple\nlines.';
    const result = findSentenceBounds(text, 5);
    expect(result).toEqual({ from: 0, to: text.length });
  });

  it('does not span across blank lines', () => {
    const text = 'First para sentence.\n\nSecond para sentence.';
    const result = findSentenceBounds(text, 5);
    expect(result.from).toBe(0);
    expect(result.to).toBe(20);
  });

  it('handles single-sentence paragraph', () => {
    const text = 'Only sentence.';
    const result = findSentenceBounds(text, 7);
    expect(result).toEqual({ from: 0, to: 14 });
  });

  it('handles consecutive punctuation like quotes after sentence end', () => {
    const text = '"Hello!" she said.';
    // Cursor inside "she said."
    const result = findSentenceBounds(text, 12);
    expect(result.from).toBe(9);
    expect(result.to).toBe(18);
  });

  it('handles ellipsis as not a sentence boundary', () => {
    const text = 'Wait... what happened?';
    const result = findSentenceBounds(text, 3);
    expect(result).toEqual({ from: 0, to: 22 });
  });

  it('handles text with no sentence-ending punctuation', () => {
    const text = 'A heading without punctuation';
    const result = findSentenceBounds(text, 10);
    expect(result).toEqual({ from: 0, to: text.length });
  });

  it('handles empty text', () => {
    const text = '';
    const result = findSentenceBounds(text, 0);
    expect(result).toEqual({ from: 0, to: 0 });
  });

  it('trims leading whitespace from sentence start', () => {
    const text = 'First. Second.';
    const result = findSentenceBounds(text, 10);
    expect(result.from).toBe(7); // 'S' not ' '
  });
});
