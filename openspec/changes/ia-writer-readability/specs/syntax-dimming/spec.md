## ADDED Requirements

### Requirement: Formatting characters render at reduced opacity
The system SHALL render markdown formatting characters at reduced opacity while keeping them visible. The dimming SHALL apply to all formatting tokens recognized by HyperMD: `.cm-formatting-strong`, `.cm-formatting-em`, `.cm-formatting-header`, `.cm-formatting-code`, `.cm-formatting-link`, `.cm-formatting-link-end`, `.cm-formatting-list`, `.cm-formatting-list-ul`, `.cm-formatting-list-ol`, `.cm-formatting-quote`. Implementation: CSS-only, targeting the `.cm-formatting` base class.

#### Scenario: Bold markers are dimmed
- **GIVEN** a line containing `**bold text**`
- **WHEN** the line is rendered in the editor
- **THEN** the `**` characters SHALL have reduced opacity (default 0.3)
- **AND** the text "bold text" SHALL render at full opacity with bold styling

#### Scenario: Heading hashes are dimmed
- **GIVEN** a line containing `## Heading`
- **WHEN** the line is rendered in the editor
- **THEN** the `##` characters SHALL have reduced opacity
- **AND** the text "Heading" SHALL render at full opacity

#### Scenario: Link syntax is dimmed
- **GIVEN** a line containing `[text](url)`
- **WHEN** the line is rendered in the editor
- **THEN** the `[`, `](`, and `)` characters SHALL have reduced opacity
- **AND** the link text "text" SHALL render at full opacity

### Requirement: Active line formatting characters are more visible
The system SHALL render formatting characters on the active line (`.cm-active`) at higher opacity than non-active lines.

#### Scenario: Cursor enters a formatted line
- **GIVEN** a line containing `*italic text*` and the cursor is NOT on this line
- **WHEN** the user moves the cursor to this line
- **THEN** the `*` characters SHALL increase to a higher opacity (default 0.7)

#### Scenario: Cursor leaves a formatted line
- **GIVEN** the cursor is on a line containing `**bold**`
- **WHEN** the user moves the cursor to a different line
- **THEN** the `**` characters SHALL return to the lower opacity (default 0.3)

### Requirement: Syntax dimming is toggleable
The system SHALL provide a plugin setting to enable or disable syntax dimming. The setting SHALL default to enabled.

#### Scenario: User disables syntax dimming
- **GIVEN** syntax dimming is enabled
- **WHEN** the user disables it in plugin settings
- **THEN** all formatting characters SHALL render at full opacity

#### Scenario: Setting persists across sessions
- **GIVEN** the user disables syntax dimming
- **WHEN** Obsidian is restarted
- **THEN** syntax dimming SHALL remain disabled
