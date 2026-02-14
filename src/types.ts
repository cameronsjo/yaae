/** Part-of-speech category identifiers */
export type POSCategory = 'adjective' | 'noun' | 'adverb' | 'verb' | 'conjunction';

/** All POS categories in display order */
export const POS_CATEGORIES: POSCategory[] = [
  'adjective',
  'noun',
  'adverb',
  'verb',
  'conjunction',
];

/** Per-POS toggle and color settings */
export interface POSCategorySettings {
  enabled: boolean;
  color: string;
}

/** A user-defined word list */
export interface CustomWordList {
  name: string;
  words: string[];
  color: string;
  enabled: boolean;
  caseSensitive: boolean;
}

/** Prose highlighting settings */
export interface ProseHighlightSettings {
  /** Master on/off toggle */
  enabled: boolean;
  /** Per-POS-category settings */
  categories: Record<POSCategory, POSCategorySettings>;
  /** Show highlighting in Reading View */
  readingViewEnabled: boolean;
  /** Custom word lists */
  customWordLists: CustomWordList[];
}

/** Default colors matching iA Writer's palette */
export const DEFAULT_POS_COLORS: Record<POSCategory, string> = {
  adjective: '#b97a0a',
  noun: '#ce4924',
  adverb: '#c333a7',
  verb: '#177eB8',
  conjunction: '#01934e',
};

export const DEFAULT_PROSE_HIGHLIGHT_SETTINGS: ProseHighlightSettings = {
  enabled: false,
  categories: {
    adjective: { enabled: true, color: DEFAULT_POS_COLORS.adjective },
    noun: { enabled: true, color: DEFAULT_POS_COLORS.noun },
    adverb: { enabled: true, color: DEFAULT_POS_COLORS.adverb },
    verb: { enabled: true, color: DEFAULT_POS_COLORS.verb },
    conjunction: { enabled: true, color: DEFAULT_POS_COLORS.conjunction },
  },
  readingViewEnabled: false,
  customWordLists: [],
};

export interface YaaeSettings {
  proseHighlight: ProseHighlightSettings;
}

export const DEFAULT_SETTINGS: YaaeSettings = {
  proseHighlight: DEFAULT_PROSE_HIGHLIGHT_SETTINGS,
};
