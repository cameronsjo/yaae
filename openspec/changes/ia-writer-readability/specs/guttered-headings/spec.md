## ADDED Requirements

### Requirement: Heading markers are outdented into a left gutter
The system SHALL push `#` heading marker characters into a left gutter area so that heading text aligns with body text. The gutter SHALL be created by adding left padding to `.cm-content .cm-line` elements and using negative margin on `.cm-formatting-header` elements. Implementation: CSS-only, targeting `.cm-formatting-header` and `.cm-formatting-header-1` through `.cm-formatting-header-6`.

#### Scenario: Single heading is outdented
- **GIVEN** a document with body text and a line `## My Heading`
- **WHEN** the document is rendered in the editor
- **THEN** the `##` characters SHALL appear in the left gutter
- **AND** the text "My Heading" SHALL be left-aligned with body text on surrounding lines

#### Scenario: Multiple heading levels maintain alignment
- **GIVEN** a document with `# H1`, `## H2`, and `### H3` headings
- **WHEN** the document is rendered in the editor
- **THEN** all heading text ("H1", "H2", "H3") SHALL start at the same horizontal position as body text
- **AND** the `#`, `##`, and `###` markers SHALL all sit within the gutter area

#### Scenario: Body text alignment is consistent
- **GIVEN** a document with mixed headings and body paragraphs
- **WHEN** the document is rendered
- **THEN** the left edge of body text and the left edge of heading text SHALL be vertically aligned

### Requirement: Guttered headings are toggleable
The system SHALL provide a plugin setting to enable or disable guttered headings. The setting SHALL default to enabled.

#### Scenario: User disables guttered headings
- **GIVEN** guttered headings are enabled
- **WHEN** the user disables it in plugin settings
- **THEN** headings SHALL render in Obsidian's default style (no gutter, no outdenting)
- **AND** the left padding on `.cm-line` elements SHALL be removed

#### Scenario: Setting persists across sessions
- **GIVEN** the user disables guttered headings
- **WHEN** Obsidian is restarted
- **THEN** guttered headings SHALL remain disabled
