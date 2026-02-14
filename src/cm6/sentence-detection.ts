const ABBREVIATIONS = new Set([
  'dr', 'mr', 'mrs', 'ms', 'prof', 'sr', 'jr', 'st',
  'vs', 'etc', 'approx', 'dept', 'est', 'vol',
  'gen', 'gov', 'sgt', 'cpl', 'pvt', 'capt', 'lt', 'col',
  'inc', 'corp', 'ltd',
]);

const MULTI_PART_ABBREVS = ['i.e', 'e.g'];

const SENTENCE_ENDINGS = new Set(['.', '!', '?']);

function isAbbreviation(text: string, dotIndex: number): boolean {
  // Check multi-part abbreviations (i.e., e.g.)
  for (const abbr of MULTI_PART_ABBREVS) {
    const start = dotIndex - abbr.length;
    if (start >= 0) {
      const candidate = text.substring(start, dotIndex + 1).toLowerCase();
      if (candidate === abbr + '.') return true;
    }
  }

  // Find the word before the dot
  let wordStart = dotIndex - 1;
  while (wordStart >= 0 && /[a-zA-Z]/.test(text[wordStart])) {
    wordStart--;
  }
  wordStart++;

  if (wordStart >= dotIndex) return false;

  const word = text.substring(wordStart, dotIndex).toLowerCase();

  // Single letter followed by dot (e.g., "U." in "U.S.A.")
  if (word.length === 1) return true;

  return ABBREVIATIONS.has(word);
}

function isSentenceEnd(text: string, index: number): boolean {
  if (!SENTENCE_ENDINGS.has(text[index])) return false;

  // Ellipsis (...) is not a sentence end
  if (
    text[index] === '.' &&
    ((index + 1 < text.length && text[index + 1] === '.') ||
      (index > 0 && text[index - 1] === '.'))
  ) {
    return false;
  }

  if (text[index] === '.' && isAbbreviation(text, index)) {
    return false;
  }

  return true;
}

/**
 * Find the bounds of the paragraph containing the cursor.
 * Paragraphs are delimited by blank lines (lines containing only whitespace).
 */
export function findParagraphBounds(
  docText: string,
  cursorOffset: number
): { from: number; to: number } {
  // Find paragraph start: search backward for a blank line
  let from = 0;
  for (let i = cursorOffset - 1; i >= 0; i--) {
    if (
      docText[i] === '\n' &&
      i > 0 &&
      docText[i - 1] === '\n'
    ) {
      from = i + 1;
      break;
    }
  }

  // Find paragraph end: search forward for a blank line
  let to = docText.length;
  for (let i = cursorOffset; i < docText.length; i++) {
    if (
      docText[i] === '\n' &&
      i + 1 < docText.length &&
      docText[i + 1] === '\n'
    ) {
      to = i;
      break;
    }
  }

  return { from, to };
}

/**
 * Find the bounds of the sentence containing the cursor within a document.
 * Sentences are delimited by `.`, `!`, `?` (with abbreviation handling).
 * Sentences cannot span across blank lines (paragraph boundaries).
 */
export function findSentenceBounds(
  docText: string,
  cursorOffset: number
): { from: number; to: number } {
  // First, confine to the current paragraph
  const para = findParagraphBounds(docText, cursorOffset);
  const text = docText.substring(para.from, para.to);
  const relCursor = cursorOffset - para.from;

  // Find sentence start: scan backward from cursor
  let sentenceStart = 0;
  for (let i = relCursor - 1; i >= 0; i--) {
    if (isSentenceEnd(text, i)) {
      // Skip trailing closing quotes/parens after the punctuation
      let afterPunc = i + 1;
      while (afterPunc < text.length && /["')\]}]/.test(text[afterPunc])) {
        afterPunc++;
      }
      sentenceStart = afterPunc;
      break;
    }
  }

  // Trim leading whitespace from sentence start
  while (sentenceStart < text.length && /\s/.test(text[sentenceStart])) {
    sentenceStart++;
  }

  // Find sentence end: scan forward from cursor
  let sentenceEnd = text.length;
  for (let i = relCursor; i < text.length; i++) {
    if (isSentenceEnd(text, i)) {
      // Include trailing closing quotes/parens
      let afterPunc = i + 1;
      while (afterPunc < text.length && /["')\]}]/.test(text[afterPunc])) {
        afterPunc++;
      }
      sentenceEnd = afterPunc;
      break;
    }
  }

  return {
    from: para.from + sentenceStart,
    to: para.from + sentenceEnd,
  };
}
