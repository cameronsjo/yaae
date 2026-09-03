/** Part-of-speech category identifiers */
export type POSCategory =
 | "adjective"
 | "noun"
 | "adverb"
 | "verb"
 | "conjunction";

/** All POS categories in display order */
export const POS_CATEGORIES: POSCategory[] = [
 "adjective",
 "noun",
 "adverb",
 "verb",
 "conjunction",
];

/** Per-POS toggle and color settings */
export interface POSCategorySettings {
 enabled: boolean;
 /** @deprecated Unread. Customize via Style Settings or the `--yaae-pos-*-color-{light,dark}` overrides. Retained only so old data.json files load. */
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
 /**
  * When true, part-of-speech spans are emitted on heading lines too. Default
  * (false) skips headings — heading text is chrome, not prose, and a
  * POS-tinted word inside an h2 reads as a glitch. Opt in per Artificer #40.
  */
 highlightInsideHeadings?: boolean;
 /**
  * @deprecated No longer read. Was a one-shot latch for the legacy
  * inline-style POS color migration, which wrote a volatile `body.style`
  * property that evaporated on restart while persisting this flag — so the
  * migration silently lost the user's color after one restart (Artificer
  * #39). The migration is removed; Style Settings and theme CSS are the sole
  * writers of `--yaae-pos-*-color-{light,dark}`. Retained only so old
  * data.json files load without error.
  */
 posColorsMigrated?: boolean;
 /**
  * Debug-only (#32): lifts the Platform.isMobile block so prose
  * highlighting can be re-tested on a phone. Toggled by the hidden
  * "Toggle prose highlighting mobile override (debug)" command — no
  * settings UI on purpose. With the highlighter's error capture in place,
  * the worst case is unhighlighted text plus a recorded error.
  */
 mobileDebugOverride?: boolean;
}

/** Default colors matching iA Writer's palette */
export const DEFAULT_POS_COLORS: Record<POSCategory, string> = {
 adjective: "#b97a0a",
 noun: "#ce4924",
 adverb: "#c333a7",
 verb: "#177eB8",
 conjunction: "#01934e",
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
 highlightInsideHeadings: false,
};

export type FocusMode = "off" | "sentence" | "paragraph";

import type { DocumentSettings } from "./document/settings";
import { DEFAULT_DOCUMENT_SETTINGS } from "./document/settings";

export interface YaaeSettings {
 proseHighlight: ProseHighlightSettings;
 syntaxDimming: boolean;
 gutteredHeadings: boolean;
 focusMode: FocusMode;
 document: DocumentSettings;
}

export const DEFAULT_SETTINGS: YaaeSettings = {
 proseHighlight: DEFAULT_PROSE_HIGHLIGHT_SETTINGS,
 syntaxDimming: true,
 gutteredHeadings: true,
 focusMode: "off",
 document: DEFAULT_DOCUMENT_SETTINGS,
};
