## ADDED Requirements

### Requirement: Sentence focus dims all text except the active sentence
The system SHALL dim all text in the editor except the sentence containing the cursor. The active sentence SHALL render at full text color. All other text SHALL render at a muted color (using `var(--text-faint)` or equivalent). Implementation: CM6 `ViewPlugin` with `Decoration.mark()`.

#### Scenario: Cursor is mid-sentence
- **GIVEN** focus mode is set to "sentence" and the document contains multiple sentences
- **WHEN** the cursor is positioned within a sentence
- **THEN** that sentence SHALL render at full contrast
- **AND** all other text in the document SHALL render at muted color

#### Scenario: Cursor moves between sentences
- **GIVEN** focus mode is set to "sentence"
- **WHEN** the user moves the cursor from one sentence to another
- **THEN** the previously active sentence SHALL become dimmed
- **AND** the newly active sentence SHALL render at full contrast

#### Scenario: Sentence boundaries are detected by punctuation
- **GIVEN** a paragraph: `First sentence. Second sentence! Third sentence?`
- **WHEN** the cursor is within "Second sentence!"
- **THEN** only "Second sentence!" SHALL render at full contrast
- **AND** sentence boundaries SHALL be detected at `.`, `!`, and `?` characters

#### Scenario: Abbreviations are not treated as sentence boundaries
- **GIVEN** a sentence: `Dr. Smith went to the store.`
- **WHEN** the cursor is within this sentence
- **THEN** the period after "Dr" SHALL NOT be treated as a sentence boundary
- **AND** the entire text up to the final `.` SHALL be treated as one sentence

### Requirement: Paragraph focus dims all text except the active paragraph
The system SHALL dim all text except the paragraph containing the cursor. Paragraphs SHALL be delimited by blank lines. Implementation: CM6 `ViewPlugin` with `Decoration.mark()`.

#### Scenario: Cursor is within a paragraph
- **GIVEN** focus mode is set to "paragraph" and the document has multiple paragraphs separated by blank lines
- **WHEN** the cursor is within a paragraph
- **THEN** that entire paragraph SHALL render at full contrast
- **AND** all other paragraphs SHALL render at muted color

#### Scenario: Cursor is on a heading line
- **GIVEN** focus mode is set to "paragraph" and a heading line is followed by body text (no blank line between)
- **WHEN** the cursor is on the heading line
- **THEN** the heading and all text until the next blank line SHALL render at full contrast

#### Scenario: Cursor is on a blank line
- **GIVEN** focus mode is set to "paragraph"
- **WHEN** the cursor is on an empty line between paragraphs
- **THEN** no paragraph SHALL be highlighted at full contrast
- **AND** all text SHALL render at muted color

### Requirement: Focus mode has three states
The system SHALL support three focus mode states: off, sentence, and paragraph. Only one state SHALL be active at a time. The state SHALL be configurable via plugin settings and togglable via command palette commands.

#### Scenario: User switches from sentence to paragraph focus
- **GIVEN** focus mode is set to "sentence"
- **WHEN** the user switches to "paragraph" via settings or command
- **THEN** sentence-level dimming SHALL be removed
- **AND** paragraph-level dimming SHALL be applied

#### Scenario: User disables focus mode
- **GIVEN** focus mode is set to "sentence" or "paragraph"
- **WHEN** the user sets focus mode to "off"
- **THEN** all dimming decorations SHALL be removed
- **AND** all text SHALL render at full contrast

#### Scenario: Toggle command cycles through states
- **GIVEN** focus mode is "off"
- **WHEN** the user invokes the "Cycle focus mode" command
- **THEN** focus mode SHALL cycle to "sentence"
- **AND** invoking the command again SHALL cycle to "paragraph"
- **AND** invoking again SHALL cycle back to "off"

### Requirement: Focus dimming pauses during scrolling
The system SHALL temporarily remove focus dimming while the user is scrolling to prevent visual flickering.

#### Scenario: User scrolls the document
- **GIVEN** focus mode is active (sentence or paragraph)
- **WHEN** the user scrolls the editor via mouse wheel or trackpad
- **THEN** focus dimming SHALL be temporarily suspended
- **AND** all text SHALL render at full contrast during the scroll
- **AND** dimming SHALL resume after scrolling stops (debounced ~150ms)
