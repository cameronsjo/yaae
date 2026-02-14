## ADDED Requirements

### Requirement: Cursor stays at a fixed vertical position
The system SHALL keep the cursor at a fixed vertical position in the viewport (default: 50%, i.e., vertically centered). As the user types or navigates, the document SHALL scroll to maintain the cursor position. Implementation: CM6 `ViewPlugin` with `EditorView.scrollIntoView()`.

#### Scenario: User types at end of document
- **GIVEN** typewriter scroll is enabled
- **WHEN** the user types new text at the end of the document
- **THEN** the document SHALL scroll so the cursor line remains at the center of the viewport

#### Scenario: User navigates with arrow keys
- **GIVEN** typewriter scroll is enabled
- **WHEN** the user presses the down arrow key
- **THEN** the document SHALL scroll to keep the cursor at the fixed vertical position

#### Scenario: Document has enough content to scroll
- **GIVEN** typewriter scroll is enabled and the document has sufficient content
- **WHEN** the cursor is near the end of the document
- **THEN** extra bottom padding SHALL be added to `.cm-sizer` so the last line can scroll to the center position

### Requirement: Typewriter scroll only activates on user input
The system SHALL only trigger typewriter scrolling in response to user-initiated events (typing, arrow keys, mouse clicks). Programmatic changes (search-and-replace, plugin updates) SHALL NOT trigger typewriter scroll repositioning.

#### Scenario: Programmatic edit does not trigger scroll
- **GIVEN** typewriter scroll is enabled
- **WHEN** a plugin programmatically modifies the document
- **THEN** the viewport SHALL NOT scroll to recenter the cursor

#### Scenario: User click triggers scroll
- **GIVEN** typewriter scroll is enabled
- **WHEN** the user clicks on a line far from center
- **THEN** the document SHALL scroll to bring the cursor to the fixed vertical position

### Requirement: Typewriter scroll is toggleable independently
The system SHALL provide a plugin setting to enable or disable typewriter scroll. The setting SHALL be independent of focus mode (both, either, or neither can be active). Default: disabled.

#### Scenario: Typewriter scroll combined with sentence focus
- **GIVEN** both typewriter scroll and sentence focus are enabled
- **WHEN** the user types a new sentence
- **THEN** the cursor SHALL remain vertically centered
- **AND** the active sentence SHALL render at full contrast while other text is dimmed

#### Scenario: User disables typewriter scroll
- **GIVEN** typewriter scroll is enabled
- **WHEN** the user disables it in plugin settings
- **THEN** the extra bottom padding on `.cm-sizer` SHALL be removed
- **AND** scrolling SHALL return to Obsidian's default behavior
