## ADDED Requirements

### Requirement: Users can create named word lists with custom colors
The system SHALL allow users to define named highlight groups, each with a list of words/phrases and a color. Words matching any enabled list SHALL be highlighted with that list's color in the editor and optionally in Reading View.

#### Scenario: Single custom list
- **WHEN** the user creates a list named "Cloud Providers" with color `#ff6600` and words ["AWS", "Azure", "GCP", "Cloudflare"]
- **AND** the document contains "We deployed to AWS and Azure"
- **THEN** "AWS" and "Azure" SHALL be highlighted in `#ff6600`

#### Scenario: Multiple custom lists
- **WHEN** the user has a "Cloud Providers" list (orange) and a "Characters" list (teal)
- **AND** the document contains both cloud provider names and character names
- **THEN** each word SHALL be highlighted in its respective list's color

#### Scenario: Custom list disabled
- **WHEN** a custom list is toggled off
- **THEN** words in that list SHALL NOT be highlighted
- **AND** other enabled lists and POS highlighting SHALL continue to work

### Requirement: Custom lists use case-insensitive matching by default
The system SHALL match words case-insensitively by default. A per-list option SHALL allow case-sensitive matching.

#### Scenario: Case-insensitive match
- **WHEN** the list contains "aws"
- **AND** the document contains "AWS", "Aws", and "aws"
- **THEN** all three occurrences SHALL be highlighted

#### Scenario: Case-sensitive match enabled
- **WHEN** the list has case-sensitive matching enabled
- **AND** the list contains "AWS"
- **THEN** only "AWS" SHALL be highlighted, not "aws" or "Aws"

### Requirement: Custom lists support multi-word phrases
The system SHALL support multi-word phrases in word lists, not just single words.

#### Scenario: Multi-word phrase matching
- **WHEN** the list contains "Google Cloud Platform"
- **AND** the document contains "We use Google Cloud Platform for hosting"
- **THEN** "Google Cloud Platform" SHALL be highlighted as a single unit

### Requirement: Custom list decorations use prefixed CSS classes
The system SHALL apply CSS classes with a `yaae-list-` prefix followed by a sanitized list name. For example, a list named "Cloud Providers" SHALL produce class `yaae-list-cloud-providers`.

#### Scenario: CSS class naming
- **WHEN** the list is named "My Characters"
- **THEN** matched words SHALL have class `yaae-list-my-characters`

### Requirement: Custom lists coexist with POS highlighting
The system SHALL allow custom list highlighting and POS highlighting to be active simultaneously. When a word matches both a POS category and a custom list, the custom list color SHALL take precedence (more specific).

#### Scenario: Overlap with POS
- **WHEN** POS highlighting is enabled with nouns in red
- **AND** a custom list highlights "AWS" in orange
- **THEN** "AWS" SHALL be highlighted in orange (custom list wins)

### Requirement: Custom lists are stored in plugin settings
The system SHALL persist custom word lists in the plugin's data storage. Each list SHALL be stored with its name, color, enabled state, case-sensitivity flag, and word entries.

#### Scenario: Lists survive restart
- **WHEN** the user creates a custom word list
- **AND** restarts Obsidian
- **THEN** the list SHALL be restored with all its configuration
