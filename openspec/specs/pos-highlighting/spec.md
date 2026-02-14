## ADDED Requirements

### Requirement: Editor highlights words by part of speech
The system SHALL color-code words in the editor by their grammatical part of speech. Five categories SHALL be supported: adjectives, nouns, adverbs, verbs, and conjunctions. Each category SHALL have a distinct default color. Highlighting SHALL be applied as CM6 mark decorations with CSS classes.

#### Scenario: All POS categories enabled
- **WHEN** prose highlighting is enabled with all categories active
- **AND** the user types "The quick brown fox jumps over the lazy dog"
- **THEN** "quick", "brown", "lazy" SHALL be highlighted as adjectives
- **AND** "fox", "dog" SHALL be highlighted as nouns
- **AND** "jumps" SHALL be highlighted as a verb

#### Scenario: Single POS category enabled
- **WHEN** only adjectives are enabled in settings
- **THEN** only adjective words SHALL be highlighted
- **AND** nouns, verbs, adverbs, and conjunctions SHALL appear unstyled

#### Scenario: Highlighting disabled
- **WHEN** prose highlighting is toggled off
- **THEN** no words SHALL have POS decorations applied

### Requirement: Highlighting is non-destructive
The system SHALL NOT modify document content. Highlighting SHALL be visual-only in the editor and SHALL NOT appear in Reading View, exported documents, or printed output.

#### Scenario: Decorations are editor-only
- **WHEN** prose highlighting is active in the editor
- **AND** the user switches to Reading View
- **THEN** no POS color styling SHALL be visible

#### Scenario: No content modification
- **WHEN** prose highlighting is active
- **AND** the user copies text from the editor
- **THEN** the copied text SHALL not contain any POS markup or styling

### Requirement: Markdown syntax is excluded from highlighting
The system SHALL NOT highlight markdown syntax characters or non-prose content. Code blocks, fenced code, inline code, YAML frontmatter, link URLs, and heading markers SHALL be skipped.

#### Scenario: Code blocks are skipped
- **WHEN** the document contains a fenced code block
- **THEN** no words inside the code block SHALL be highlighted

#### Scenario: Frontmatter is skipped
- **WHEN** the document begins with YAML frontmatter
- **THEN** no words inside the frontmatter SHALL be highlighted

#### Scenario: Inline code is skipped
- **WHEN** a word appears inside backtick-delimited inline code
- **THEN** that word SHALL NOT be highlighted

#### Scenario: Heading markers are skipped
- **WHEN** a line begins with `#` heading markers
- **THEN** the `#` characters SHALL NOT be highlighted
- **AND** the heading text itself SHALL be highlighted normally

### Requirement: Only visible text is processed
The system SHALL only perform NLP tagging on text within the editor's visible viewport. Text outside the viewport SHALL NOT be processed until it becomes visible.

#### Scenario: Large document performance
- **WHEN** a 10,000-line document is open
- **AND** the user is viewing lines 500-550
- **THEN** only lines within the visible viewport SHALL be tagged
- **AND** scrolling to new lines SHALL tag them as they become visible

### Requirement: Typing updates highlighting incrementally
The system SHALL update highlighting efficiently during typing. Single-character insertions SHALL only retag the affected line, not the entire viewport.

#### Scenario: Single character typing
- **WHEN** the user types a single character on a line
- **THEN** only that line's POS decorations SHALL be recalculated
- **AND** all other lines' decorations SHALL remain unchanged

#### Scenario: Paste or bulk edit
- **WHEN** the user pastes multiple lines or performs a bulk edit
- **THEN** the entire visible viewport SHALL be retagged

### Requirement: Each POS category uses a prefixed CSS class
The system SHALL apply CSS classes with a `yaae-pos-` prefix to avoid collisions with other plugins or themes. The classes SHALL be: `yaae-pos-adjective`, `yaae-pos-noun`, `yaae-pos-adverb`, `yaae-pos-verb`, `yaae-pos-conjunction`.

#### Scenario: CSS class naming
- **WHEN** the word "quickly" is tagged as an adverb
- **THEN** it SHALL be wrapped in a mark decoration with class `yaae-pos-adverb`
