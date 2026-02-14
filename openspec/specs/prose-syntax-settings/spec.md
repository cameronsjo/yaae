## ADDED Requirements

### Requirement: Settings tab for prose highlighting
The system SHALL provide a settings tab within Obsidian's plugin settings. The tab SHALL allow the user to configure all prose highlighting options.

#### Scenario: Settings tab is accessible
- **WHEN** the user opens Settings → Community Plugins → YAAE
- **THEN** a settings section for prose highlighting SHALL be visible

### Requirement: Global toggle for prose highlighting
The system SHALL provide a master toggle to enable or disable all prose highlighting. When disabled, no POS decorations SHALL be applied regardless of per-category settings.

#### Scenario: Master toggle off
- **WHEN** the user disables the prose highlighting master toggle
- **THEN** all POS decorations SHALL be removed from all editors

#### Scenario: Master toggle on
- **WHEN** the user enables the prose highlighting master toggle
- **THEN** POS decorations SHALL be applied according to per-category settings

### Requirement: Per-POS-category toggle
The system SHALL provide individual toggles for each of the five POS categories: adjectives, nouns, adverbs, verbs, and conjunctions. Each toggle SHALL independently control whether that category is highlighted.

#### Scenario: Disable a single category
- **WHEN** the user disables the adverbs toggle
- **THEN** adverb highlighting SHALL be removed
- **AND** all other enabled categories SHALL continue to be highlighted

#### Scenario: All categories disabled
- **WHEN** all five category toggles are disabled
- **THEN** no POS decorations SHALL be applied (equivalent to master toggle off)

### Requirement: Per-POS-category color picker
The system SHALL provide a color picker for each POS category. The selected color SHALL be applied immediately without requiring a plugin reload.

#### Scenario: Change adjective color
- **WHEN** the user changes the adjective color from amber to red
- **THEN** all adjective decorations in open editors SHALL immediately reflect the new color

#### Scenario: Default colors
- **WHEN** the plugin is first installed
- **THEN** the default colors SHALL be: adjectives `#b97a0a`, nouns `#ce4924`, adverbs `#c333a7`, verbs `#177eB8`, conjunctions `#01934e`

### Requirement: Command palette toggle
The system SHALL register a command in Obsidian's command palette to toggle prose highlighting on/off. The command SHALL be bindable to a hotkey.

#### Scenario: Toggle via command palette
- **WHEN** the user opens the command palette and selects "Toggle prose highlighting"
- **THEN** prose highlighting SHALL toggle between enabled and disabled

#### Scenario: Hotkey binding
- **WHEN** the user assigns a hotkey to the toggle command
- **AND** presses that hotkey
- **THEN** prose highlighting SHALL toggle

### Requirement: Settings persist across sessions
The system SHALL persist all prose highlighting settings (master toggle, per-category toggles, colors) across Obsidian restarts using the plugin's data storage.

#### Scenario: Settings survive restart
- **WHEN** the user customizes highlighting settings
- **AND** restarts Obsidian
- **THEN** all settings SHALL be restored to their customized values
