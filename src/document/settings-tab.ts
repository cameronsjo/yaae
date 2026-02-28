import { Setting, setTooltip } from 'obsidian';
import type YaaePlugin from '../../main';
import {
  getAllClassificationIds,
  getClassificationMeta,
  type WatermarkLevel,
} from '../schemas';
import type { LinksMode, ThemeMode } from './settings';
import { createCollapsibleSection } from '../settings/collapsible-section';

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

  const customHeading = new Setting(classContent)
    .setName('Custom classifications')
    .setDesc(
      'Define custom classification levels. These override built-in levels with the same ID. ' +
      'Use the ID in frontmatter (e.g., classification: non-sensitive).',
    );
  customHeading.settingEl.style.marginTop = '12px';

  const customListEl = classContent.createDiv('yaae-custom-classifications');

  async function saveAndRefreshPrintStyles() {
    await plugin.saveSettings();
    plugin.classificationPrintStyles.update(plugin.settings.document.customClassifications);
  }

  function renderCustomClassifications() {
    customListEl.empty();
    const customs = plugin.settings.document.customClassifications;

    for (let i = 0; i < customs.length; i++) {
      const entry = customs[i];

      const row = new Setting(customListEl)
        .setName(entry.label || entry.id || 'New classification')
        .setDesc(entry.id ? `Frontmatter value: ${entry.id}` : '');

      row.addText((text) =>
        text
          .setPlaceholder('ID (e.g., non-sensitive)')
          .setValue(entry.id)
          .onChange(async (value) => {
            entry.id = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            row.setDesc(entry.id ? `Frontmatter value: ${entry.id}` : 'ID required');
            row.settingEl.toggleClass('is-invalid', !entry.id);
            if (entry.id) await saveAndRefreshPrintStyles();
          }),
      );

      row.addText((text) =>
        text
          .setPlaceholder('Label (e.g., NON-SENSITIVE)')
          .setValue(entry.label)
          .onChange(async (value) => {
            entry.label = value;
            row.setName(value || entry.id || 'New classification');
            await saveAndRefreshPrintStyles();
          }),
      );

      const colorPicker = row.addColorPicker((picker) =>
        picker.setValue(entry.color).onChange(async (value) => {
          entry.color = value;
          await saveAndRefreshPrintStyles();
        }),
      );
      setTooltip(colorPicker.colorPickerEl, 'Text color');

      const bgPicker = row.addColorPicker((picker) =>
        picker.setValue(entry.background).onChange(async (value) => {
          entry.background = value;
          await saveAndRefreshPrintStyles();
        }),
      );
      setTooltip(bgPicker.colorPickerEl, 'Background color');

      row.addExtraButton((btn) =>
        btn.setIcon('trash').setTooltip('Remove').onClick(async () => {
          customs.splice(i, 1);
          await saveAndRefreshPrintStyles();
          renderCustomClassifications();
        }),
      );
    }

    // Add button
    new Setting(customListEl).addButton((btn) =>
      btn.setButtonText('Add classification').onClick(async () => {
        customs.push({
          id: '',
          label: '',
          color: '#666666',
          background: '#f5f5f5',
        });
        await plugin.saveSettings();
        renderCustomClassifications();
      }),
    );
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

  new Setting(appearanceContent)
    .setName('Font family')
    .setDesc('Font stack for PDF export. Named presets use safe system fonts.')
    .addDropdown((dropdown) =>
      dropdown
        .addOption('sans', 'Sans-serif')
        .addOption('serif', 'Serif')
        .addOption('mono', 'Monospace')
        .addOption('system', 'System default')
        .setValue(
          ['sans', 'serif', 'mono', 'system'].includes(plugin.settings.document.fontFamily)
            ? plugin.settings.document.fontFamily
            : 'sans'
        )
        .onChange(async (value) => {
          plugin.settings.document.fontFamily = value;
          plugin.dynamicPdfPrintStyles.update(plugin.settings.document);
          await plugin.saveSettings();
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
    plugin.headerFooterPrintStyles.update(plugin.settings.document);
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
