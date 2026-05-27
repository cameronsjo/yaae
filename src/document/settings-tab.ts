import { Setting, setTooltip } from 'obsidian';
import type YaaePlugin from '../../main';
import {
  getAllClassificationIds,
  getClassificationMeta,
  type CustomClassification,
  type WatermarkLevel,
} from '../schemas';
import type { LinksMode, ThemeMode } from './settings';
import { createCollapsibleSection } from '../settings/collapsible-section';
import {
  FONT_CUSTOM_SENTINEL,
  isFontPreset,
  isValidClassificationId,
  sanitizeClassificationId,
} from './settings-tab-helpers';

/**
 * Render the Document settings section into the plugin settings tab.
 */
export function renderDocumentSettings(
  containerEl: HTMLElement,
  plugin: YaaePlugin,
  expandedSections: Set<string>,
): void {
  // =================================================================
  // Classification
  // =================================================================
  const classContent = createCollapsibleSection(
    containerEl, expandedSections, 'doc-classification', 'Classification', true,
  );

  const allIds = getAllClassificationIds(plugin.settings.document.customClassifications);

  new Setting(classContent)
    .setName('Default classification')
    .setDesc('Classification level applied to new documents.')
    .addDropdown((dropdown) => {
      for (const id of allIds) {
        const meta = getClassificationMeta(id, plugin.settings.document.customClassifications);
        dropdown.addOption(id, meta?.label ?? id);
      }
      dropdown
        .setValue(plugin.settings.document.defaultClassification)
        .onChange(async (value) => {
          plugin.settings.document.defaultClassification = value;
          await plugin.saveSettings();
        });
    });

  new Setting(classContent)
    .setName('Show classification banner')
    .setDesc('Display a classification banner in reading view.')
    .addToggle((toggle) =>
      toggle
        .setValue(plugin.settings.document.showClassificationBanner)
        .onChange(async (value) => {
          plugin.settings.document.showClassificationBanner = value;
          await plugin.saveSettings();
        }),
    );

  new Setting(classContent)
    .setName('Banner position')
    .setDesc('Where to display classification banners in PDF export.')
    .addDropdown((dropdown) =>
      dropdown
        .addOption('top', 'Top only')
        .addOption('both', 'Top and bottom')
        .setValue(plugin.settings.document.bannerPosition)
        .onChange(async (value) => {
          plugin.settings.document.bannerPosition = value as 'top' | 'both';
          await plugin.saveSettings();
        }),
    );

  // --- Custom Classifications ---

  new Setting(classContent)
    .setName('Custom classifications')
    .setDesc(
      'Define custom classification levels. These override built-in levels with the same ID. ' +
      'Use the ID in frontmatter (e.g., classification: non-sensitive).',
    )
    .setHeading();

  const customListEl = classContent.createDiv('yaae-custom-classifications');

  async function saveAndRefreshPrintStyles() {
    await plugin.saveSettings();
    plugin.pageChromeManager.update(plugin.buildPageChromeState());
  }

  // Draft entry for the "Add classification" flow. Held outside
  // `customClassifications` until it has a valid ID, so partial entries
  // never get persisted to disk (and an interrupted edit can't load a
  // half-written `id: ''` row on next reload).
  let draftEntry: CustomClassification | null = null;

  function renderCustomClassifications() {
    customListEl.empty();
    const customs = plugin.settings.document.customClassifications;

    type RowSource =
      | { kind: 'persisted'; entry: CustomClassification; index: number }
      | { kind: 'draft'; entry: CustomClassification };

    const rows: RowSource[] = customs.map((entry, index) => ({
      kind: 'persisted',
      entry,
      index,
    }));
    if (draftEntry) rows.push({ kind: 'draft', entry: draftEntry });

    for (const source of rows) {
      const entry = source.entry;
      const isDraft = source.kind === 'draft';

      const row = new Setting(customListEl)
        .setName(entry.label || entry.id || 'New classification')
        .setDesc(
          isDraft
            ? 'ID required — type a slug (e.g., non-sensitive)'
            : entry.id
              ? `Frontmatter value: ${entry.id}`
              : '',
        );
      if (isDraft) row.settingEl.toggleClass('is-invalid', true);

      row.addText((text) =>
        text
          .setPlaceholder('ID (e.g., non-sensitive)')
          .setValue(entry.id)
          .onChange(async (value) => {
            entry.id = sanitizeClassificationId(value);
            const valid = isValidClassificationId(entry.id);
            // Frontmatter resolution returns the first matching custom, so a
            // duplicate ID silently shadows the older entry. Block save on
            // collision and surface the conflict instead.
            const duplicate = valid && customs.some(
              (c, i) =>
                c.id === entry.id &&
                !(source.kind === 'persisted' && i === source.index),
            );
            row.setDesc(
              !valid
                ? 'ID required — at least one letter or digit'
                : duplicate
                  ? `ID "${entry.id}" already in use — choose a different ID`
                  : `Frontmatter value: ${entry.id}`,
            );
            row.settingEl.toggleClass('is-invalid', !valid || duplicate);

            if (!valid || duplicate) return;

            if (source.kind === 'draft') {
              // Commit the draft into the persisted list. Re-render so the
              // row is now backed by the array (gets a real index, trash
              // button works, future edits hit the correct slot).
              customs.push(entry);
              draftEntry = null;
              await saveAndRefreshPrintStyles();
              renderCustomClassifications();
              return;
            }

            await saveAndRefreshPrintStyles();
          }),
      );

      row.addText((text) =>
        text
          .setPlaceholder('Label (e.g., NON-SENSITIVE)')
          .setValue(entry.label)
          .onChange(async (value) => {
            entry.label = value;
            row.setName(value || entry.id || 'New classification');
            // Only persist when the entry has a real, valid ID. Drafts and
            // entries with placeholder IDs stay in memory until a valid ID
            // is typed.
            if (!isDraft && isValidClassificationId(entry.id)) {
              await saveAndRefreshPrintStyles();
            }
          }),
      );

      const colorPicker = row.addColorPicker((picker) =>
        picker.setValue(entry.color).onChange(async (value) => {
          entry.color = value;
          if (!isDraft && isValidClassificationId(entry.id)) {
            await saveAndRefreshPrintStyles();
          }
        }),
      );
      setTooltip(colorPicker.colorPickerEl, 'Light theme — text color');

      const bgPicker = row.addColorPicker((picker) =>
        picker.setValue(entry.background).onChange(async (value) => {
          entry.background = value;
          if (!isDraft && isValidClassificationId(entry.id)) {
            await saveAndRefreshPrintStyles();
          }
        }),
      );
      setTooltip(bgPicker.colorPickerEl, 'Light theme — background color');

      row.addExtraButton((btn) =>
        btn.setIcon('trash').setTooltip('Remove').onClick(async () => {
          if (source.kind === 'draft') {
            draftEntry = null;
            renderCustomClassifications();
            return;
          }
          customs.splice(source.index, 1);
          await saveAndRefreshPrintStyles();
          renderCustomClassifications();
        }),
      );

      // Dark-theme overrides — second row, optional. Empty = inherit from light.
      const darkRow = new Setting(customListEl)
        .setClass('yaae-classification-dark-row')
        .setName('')
        .setDesc('Dark theme (leave at defaults to inherit light values)');

      const darkColorPicker = darkRow.addColorPicker((picker) =>
        picker.setValue(entry.colorDark ?? entry.color).onChange(async (value) => {
          entry.colorDark = value;
          await saveAndRefreshPrintStyles();
        }),
      );
      setTooltip(darkColorPicker.colorPickerEl, 'Dark theme — text color');

      const darkBgPicker = darkRow.addColorPicker((picker) =>
        picker.setValue(entry.backgroundDark ?? entry.background).onChange(async (value) => {
          entry.backgroundDark = value;
          await saveAndRefreshPrintStyles();
        }),
      );
      setTooltip(darkBgPicker.colorPickerEl, 'Dark theme — background color');

      // Reset to inherit-from-light
      darkRow.addExtraButton((btn) =>
        btn.setIcon('reset').setTooltip('Reset dark colors (inherit from light)').onClick(async () => {
          entry.colorDark = undefined;
          entry.backgroundDark = undefined;
          await saveAndRefreshPrintStyles();
          renderCustomClassifications();
        }),
      );
    }

    // "Add classification" creates an in-memory draft only — disabled while
    // a draft is already pending so the UI stays honest about what's
    // persisted vs. what's still being typed.
    new Setting(customListEl).addButton((btn) => {
      btn.setButtonText('Add classification').onClick(() => {
        if (draftEntry) return;
        draftEntry = {
          id: '',
          label: '',
          color: '#666666',
          background: '#f5f5f5',
        };
        renderCustomClassifications();
      });
      if (draftEntry) btn.setDisabled(true);
    });
  }

  renderCustomClassifications();

  // =================================================================
  // PDF Appearance
  // =================================================================
  const appearanceContent = createCollapsibleSection(
    containerEl, expandedSections, 'doc-appearance', 'PDF Appearance',
  );

  new Setting(appearanceContent)
    .setName('Theme')
    .setDesc('Color scheme for PDF export.')
    .addDropdown((dropdown) =>
      dropdown
        .addOption('light', 'Light')
        .addOption('dark', 'Dark')
        .addOption('auto', 'Auto (follow OS)')
        .setValue(plugin.settings.document.theme)
        .onChange(async (value) => {
          plugin.settings.document.theme = value as ThemeMode;
          await plugin.saveSettings();
        }),
    );

  // Font family: named presets pipe to static CSS classes; arbitrary strings
  // go through DynamicPdfPrintStyleManager. The dropdown surfaces a
  // "Custom..." option that reveals the text input row below — this prevents
  // the prior bug where opening the dropdown to inspect would silently
  // overwrite an arbitrary `fontFamily` (e.g. "Inter") with "sans" because
  // the dropdown fell back to "sans" on first render.
  const currentFont = plugin.settings.document.fontFamily;
  const fontIsCustom = !isFontPreset(currentFont);

  // Build the custom-font row first so we can reference its element from
  // the dropdown's onChange handler.
  let focusCustomFontInput: (() => void) | null = null;
  const customFontRow = new Setting(appearanceContent)
    .setName('Custom font')
    .setDesc('Comma-separated font stack (e.g., "Inter", -apple-system, sans-serif).')
    .addText((text) => {
      focusCustomFontInput = () => text.inputEl.focus();
      text
        .setPlaceholder('"Inter", -apple-system, sans-serif')
        .setValue(fontIsCustom ? currentFont : '')
        .onChange(async (value) => {
          const trimmed = value.trim();
          if (!trimmed) return;
          plugin.settings.document.fontFamily = trimmed;
          plugin.dynamicPdfPrintStyles.update(plugin.settings.document);
          await plugin.saveSettings();
        });
    });
  if (!fontIsCustom) customFontRow.settingEl.setAttribute('hidden', '');

  new Setting(appearanceContent)
    .setName('Font family')
    .setDesc('Font stack for PDF export. Named presets use safe system fonts.')
    .addDropdown((dropdown) =>
      dropdown
        .addOption('sans', 'Sans-serif')
        .addOption('serif', 'Serif')
        .addOption('mono', 'Monospace')
        .addOption('system', 'System default')
        .addOption(FONT_CUSTOM_SENTINEL, 'Custom...')
        .setValue(fontIsCustom ? FONT_CUSTOM_SENTINEL : currentFont)
        .onChange(async (value) => {
          if (value === FONT_CUSTOM_SENTINEL) {
            // Reveal the custom input but DO NOT overwrite the stored
            // fontFamily. If the stored value was already a custom string,
            // this is a no-op for state; if it was a preset, the user must
            // type a value before anything is persisted.
            customFontRow.settingEl.removeAttribute('hidden');
            focusCustomFontInput?.();
            return;
          }
          plugin.settings.document.fontFamily = value;
          plugin.dynamicPdfPrintStyles.update(plugin.settings.document);
          await plugin.saveSettings();
          customFontRow.settingEl.setAttribute('hidden', '');
        }),
    );

  new Setting(appearanceContent)
    .setName('Font size')
    .setDesc('Base font size for PDF export (6-24 pt).')
    .addSlider((slider) =>
      slider
        .setLimits(6, 24, 1)
        .setValue(plugin.settings.document.fontSize)
        .setDynamicTooltip()
        .onChange(async (value) => {
          plugin.settings.document.fontSize = value;
          plugin.dynamicPdfPrintStyles.update(plugin.settings.document);
          await plugin.saveSettings();
        }),
    );

  new Setting(appearanceContent)
    .setName('Line height')
    .setDesc('Line spacing for PDF export (1.0–3.0).')
    .addSlider((slider) =>
      slider
        .setLimits(10, 30, 1)
        .setValue(Math.round(plugin.settings.document.lineHeight * 10))
        .setDynamicTooltip()
        .onChange(async (value) => {
          plugin.settings.document.lineHeight = value / 10;
          plugin.dynamicPdfPrintStyles.update(plugin.settings.document);
          await plugin.saveSettings();
        }),
    );

  // =================================================================
  // PDF Text
  // =================================================================
  const textContent = createCollapsibleSection(
    containerEl, expandedSections, 'doc-text', 'PDF Text',
  );

  new Setting(textContent)
    .setName('Links')
    .setDesc(
      'How links appear in PDF export. ' +
      'Can also be set per-document via export.pdf.links in frontmatter.',
    )
    .addDropdown((dropdown) =>
      dropdown
        .addOption('expand', 'Expand (show URL)')
        .addOption('styled', 'Styled (blue, no URL)')
        .addOption('plain', 'Plain (no styling)')
        .addOption('stripped', 'Stripped (pure text)')
        .addOption('defanged', 'Defanged (hxxps://)')
        .setValue(plugin.settings.document.links)
        .onChange(async (value) => {
          plugin.settings.document.links = value as LinksMode;
          await plugin.saveSettings();
        }),
    );

  new Setting(textContent)
    .setName('Copy-paste safe')
    .setDesc(
      'Disable ligatures (fi, fl, ffi) so copied text pastes correctly in all PDF viewers.',
    )
    .addToggle((toggle) =>
      toggle
        .setValue(plugin.settings.document.copyPasteSafe)
        .onChange(async (value) => {
          plugin.settings.document.copyPasteSafe = value;
          await plugin.saveSettings();
        }),
    );

  new Setting(textContent)
    .setName('Compact tables')
    .setDesc('Reduce table font size and padding for denser data display in PDF export.')
    .addToggle((toggle) =>
      toggle
        .setValue(plugin.settings.document.compactTables)
        .onChange(async (value) => {
          plugin.settings.document.compactTables = value;
          await plugin.saveSettings();
        }),
    );

  // =================================================================
  // PDF Layout
  // =================================================================
  const layoutContent = createCollapsibleSection(
    containerEl, expandedSections, 'doc-layout', 'PDF Layout',
  );

  new Setting(layoutContent)
    .setName('Page numbers')
    .setDesc('Show page numbers in PDF export.')
    .addToggle((toggle) =>
      toggle
        .setValue(plugin.settings.document.pageNumbers)
        .onChange(async (value) => {
          plugin.settings.document.pageNumbers = value;
          await plugin.saveSettings();
        }),
    );

  new Setting(layoutContent)
    .setName('TOC depth')
    .setDesc('Maximum heading depth for generated tables of contents (1-6).')
    .addSlider((slider) =>
      slider
        .setLimits(1, 6, 1)
        .setValue(plugin.settings.document.tocDepth)
        .setDynamicTooltip()
        .onChange(async (value) => {
          plugin.settings.document.tocDepth = value;
          await plugin.saveSettings();
        }),
    );

  // =================================================================
  // PDF Branding
  // =================================================================
  const brandingContent = createCollapsibleSection(
    containerEl, expandedSections, 'doc-branding', 'PDF Branding',
  );

  new Setting(brandingContent)
    .setName('Default watermark for drafts')
    .setDesc('Watermark level automatically applied to draft documents.')
    .addDropdown((dropdown) =>
      dropdown
        .addOption('off', 'Off')
        .addOption('whisper', 'Whisper')
        .addOption('heads-up', 'Heads Up')
        .addOption('loud', 'Loud')
        .addOption('screaming', 'Screaming')
        .setValue(plugin.settings.document.defaultWatermarkForDrafts)
        .onChange(async (value) => {
          plugin.settings.document.defaultWatermarkForDrafts = value as WatermarkLevel;
          await plugin.saveSettings();
        }),
    );

  new Setting(brandingContent)
    .setName('Watermark text')
    .setDesc('Text displayed in the watermark overlay. Applied to all watermark intensity levels.')
    .addText((text) =>
      text
        .setPlaceholder('DRAFT')
        .setValue(plugin.settings.document.watermarkText)
        .onChange(async (value) => {
          plugin.settings.document.watermarkText = value || 'DRAFT';
          plugin.dynamicPdfPrintStyles.update(plugin.settings.document);
          await plugin.saveSettings();
        }),
    );

  async function saveAndRefreshHeaderFooter() {
    await plugin.saveSettings();
    plugin.pageChromeManager.update(plugin.buildPageChromeState());
  }

  new Setting(brandingContent)
    .setName('Default header (left)')
    .setDesc('Default left header text for PDF export. Appears on every printed page.')
    .addText((text) =>
      text
        .setPlaceholder('e.g., Company Name')
        .setValue(plugin.settings.document.defaultHeaderLeft)
        .onChange(async (value) => {
          plugin.settings.document.defaultHeaderLeft = value;
          await saveAndRefreshHeaderFooter();
        }),
    );

  new Setting(brandingContent)
    .setName('Default header (right)')
    .setDesc('Default right header text for PDF export. Appears on every printed page.')
    .addText((text) =>
      text
        .setPlaceholder('e.g., Department')
        .setValue(plugin.settings.document.defaultHeaderRight)
        .onChange(async (value) => {
          plugin.settings.document.defaultHeaderRight = value;
          await saveAndRefreshHeaderFooter();
        }),
    );

  new Setting(brandingContent)
    .setName('Default footer (left)')
    .setDesc('Default left footer text for PDF export.')
    .addText((text) =>
      text
        .setPlaceholder('')
        .setValue(plugin.settings.document.defaultFooterLeft)
        .onChange(async (value) => {
          plugin.settings.document.defaultFooterLeft = value;
          await saveAndRefreshHeaderFooter();
        }),
    );

  new Setting(brandingContent)
    .setName('Default footer (right)')
    .addText((text) =>
      text
        .setPlaceholder('')
        .setValue(plugin.settings.document.defaultFooterRight)
        .onChange(async (value) => {
          plugin.settings.document.defaultFooterRight = value;
          await saveAndRefreshHeaderFooter();
        }),
    );

  // =================================================================
  // Validation
  // =================================================================
  const validationContent = createCollapsibleSection(
    containerEl, expandedSections, 'doc-validation', 'Validation',
  );

  new Setting(validationContent)
    .setName('Validate on save')
    .setDesc('Automatically validate frontmatter when files are saved (warnings to console only).')
    .addToggle((toggle) =>
      toggle
        .setValue(plugin.settings.document.validateOnSave)
        .onChange(async (value) => {
          plugin.settings.document.validateOnSave = value;
          await plugin.saveSettings();
        }),
    );
}
