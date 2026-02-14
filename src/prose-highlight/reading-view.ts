import type { MarkdownPostProcessorContext } from 'obsidian';
import type YaaePlugin from '../../main';
import { CompromiseTagger } from './tagger';
import { WordListMatcher } from './word-lists';
import type { POSTag } from './tagger';
import type { WordListMatch } from './word-lists';
import type { POSCategory } from '../types';

/** Elements whose text content should not be processed */
const SKIP_SELECTORS = 'code, pre, .frontmatter, .math, .MathJax';

/** POS category → CSS class */
const POS_CLASS: Record<POSCategory, string> = {
  adjective: 'yaae-pos-adjective',
  noun: 'yaae-pos-noun',
  adverb: 'yaae-pos-adverb',
  verb: 'yaae-pos-verb',
  conjunction: 'yaae-pos-conjunction',
};

/**
 * Creates a MarkdownPostProcessor that highlights prose in Reading View.
 * Uses TreeWalker to find text nodes, runs POS tagger + word list matcher,
 * then wraps matched words in <span> elements with CSS classes.
 */
export function createReadingViewPostProcessor(plugin: YaaePlugin) {
  const tagger = new CompromiseTagger();
  const listMatcher = new WordListMatcher();

  return (el: HTMLElement, _ctx: MarkdownPostProcessorContext) => {
    const settings = plugin.settings.proseHighlight;
    if (!settings.enabled || !settings.readingViewEnabled) return;

    // Recompile word lists (cheap if unchanged, safe if settings changed)
    listMatcher.compile(settings.customWordLists);

    // Collect text nodes, skipping code/pre/frontmatter
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(
      el,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node: Text): number {
          // Skip if inside an excluded element
          if (node.parentElement?.closest(SKIP_SELECTORS)) {
            return NodeFilter.FILTER_REJECT;
          }
          // Skip whitespace-only nodes
          if (!node.textContent?.trim()) {
            return NodeFilter.FILTER_SKIP;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
    }

    // Process each text node
    for (const textNode of textNodes) {
      const text = textNode.textContent || '';
      if (!text.trim()) continue;

      // Get POS tags and word list matches
      const posTags = tagger.tag(text);
      const listMatches = listMatcher.match(text);

      // Merge into a single sorted list of spans to wrap
      const spans = buildSpans(posTags, listMatches, settings);
      if (spans.length === 0) continue;

      // Build a DocumentFragment replacing this text node
      const fragment = document.createDocumentFragment();
      let lastEnd = 0;

      for (const span of spans) {
        // Text before this span
        if (span.start > lastEnd) {
          fragment.appendChild(
            document.createTextNode(text.slice(lastEnd, span.start)),
          );
        }

        // The highlighted span
        const spanEl = document.createElement('span');
        spanEl.className = span.cssClass;
        spanEl.textContent = text.slice(span.start, span.end);
        fragment.appendChild(spanEl);

        lastEnd = span.end;
      }

      // Remaining text after last span
      if (lastEnd < text.length) {
        fragment.appendChild(
          document.createTextNode(text.slice(lastEnd)),
        );
      }

      textNode.parentNode?.replaceChild(fragment, textNode);
    }
  };
}

interface HighlightSpan {
  start: number;
  end: number;
  cssClass: string;
}

/**
 * Merge POS tags and word list matches into non-overlapping spans.
 * Word list matches take precedence over POS tags.
 */
function buildSpans(
  posTags: POSTag[],
  listMatches: WordListMatch[],
  settings: { categories: Record<POSCategory, { enabled: boolean }> },
): HighlightSpan[] {
  const spans: HighlightSpan[] = [];

  // Add word list matches first (they win on overlap)
  const covered = new Set<number>();
  for (const m of listMatches) {
    spans.push({ start: m.start, end: m.end, cssClass: m.cssClass });
    for (let i = m.start; i < m.end; i++) covered.add(i);
  }

  // Add POS tags that don't overlap with list matches
  for (const tag of posTags) {
    if (!settings.categories[tag.pos]?.enabled) continue;
    if (covered.has(tag.start)) continue;
    spans.push({
      start: tag.start,
      end: tag.end,
      cssClass: POS_CLASS[tag.pos],
    });
  }

  spans.sort((a, b) => a.start - b.start);
  return spans;
}
