## ADDED Requirements

### Requirement: POS decorations are hidden in print and PDF export
The system SHALL suppress all POS and custom list highlighting in print mode and PDF export by default. The exported/printed document SHALL appear as if highlighting were disabled.

#### Scenario: PDF export is clean
- **WHEN** prose highlighting is active in the editor
- **AND** the user exports the document to PDF
- **THEN** the PDF SHALL NOT contain any POS or custom list color styling

#### Scenario: Print mode is clean
- **WHEN** prose highlighting is active
- **AND** the user prints the document
- **THEN** the printed output SHALL NOT contain any POS or custom list color styling

### Requirement: Suppression uses CSS media queries and selectors
The system SHALL implement print suppression via `@media print` rules and `.print` CSS selectors in the plugin's stylesheet, not via JavaScript detection.

#### Scenario: CSS-based suppression
- **WHEN** the plugin is loaded
- **THEN** `styles.css` SHALL contain `@media print` rules that reset all `yaae-pos-*` and `yaae-list-*` classes to `color: inherit`
- **AND** `.print [class*="yaae-"]` rules SHALL reset colors in Obsidian's export container
