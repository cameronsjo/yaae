import { Setting } from 'obsidian';
import type YaaePlugin from '../../main';
import {
  getAllClassificationIds,
  getClassificationMeta,
} from '../schemas';

/**
 * Render the Document settings section into the plugin settings tab.
 */
export function renderDocumentSettings(
  containerEl: HTMLElement,
  plugin: YaaePlugin,
): void {
  new Setting(containerEl).setName('Document').setHeading();

  // --- Classification ---

  // Build dropdown options from built-in + custom
  const allIds = getAllClassificationIds(plugin.settings.document.customClassifications);

  new Setting(containerEl)
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

  new Setting(containerEl)
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

  new Setting(containerEl)
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

  new Setting(containerEl)
    .setName('Custom classifications')
    .setDesc(
      'Define custom classification levels. These override built-in levels with the same ID. ' +
      'Use the ID in frontmatter (e.g., classification: non-sensitive).',
    )
    .setHeading();

  const customListEl = containerEl.createDiv('yaae-custom-classifications');

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
            row.setDesc(entry.id ? `Frontmatter value: ${entry.id}` : '');
            await plugin.saveSettings();
          }),
      );

      row.addText((text) =>
        text
          .setPlaceholder('Label (e.g., NON-SENSITIVE)')
          .setValue(entry.label)
          .onChange(async (value) => {
            entry.label = value;
            row.setName(value || entry.id || 'New classification');
            await plugin.saveSettings();
          }),
      );

      row.addColorPicker((picker) =>
        picker.setValue(entry.color).onChange(async (value) => {
          entry.color = value;
          await plugin.saveSettings();
        }),
      );

      row.addColorPicker((picker) =>
        picker.setValue(entry.background).onChange(async (value) => {
          entry.background = value;
          await plugin.saveSettings();
        }),
      );

      row.addExtraButton((btn) =>
        btn.setIcon('trash').setTooltip('Remove').onClick(async () => {
          customs.splice(i, 1);
          await plugin.saveSettings();
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

  // --- Watermark ---
  new Setting(containerEl)
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
          plugin.settings.document.defaultWatermarkForDrafts = value as any;
          await plugin.saveSettings();
        }),
    );

  // --- Headers & Footers ---
  new Setting(containerEl)
    .setName('Default header (left)')
    .setDesc('Default left header text for PDF export.')
    .addText((text) =>
      text
        .setPlaceholder('e.g., Company Name')
        .setValue(plugin.settings.document.defaultHeaderLeft)
        .onChange(async (value) => {
          plugin.settings.document.defaultHeaderLeft = value;
          await plugin.saveSettings();
        }),
    );

  new Setting(containerEl)
    .setName('Default header (right)')
    .setDesc('Default right header text for PDF export.')
    .addText((text) =>
      text
        .setPlaceholder('e.g., Department')
        .setValue(plugin.settings.document.defaultHeaderRight)
        .onChange(async (value) => {
          plugin.settings.document.defaultHeaderRight = value;
          await plugin.saveSettings();
        }),
    );

  new Setting(containerEl)
    .setName('Default footer (left)')
    .addText((text) =>
      text
        .setPlaceholder('')
        .setValue(plugin.settings.document.defaultFooterLeft)
        .onChange(async (value) => {
          plugin.settings.document.defaultFooterLeft = value;
          await plugin.saveSettings();
        }),
    );

  new Setting(containerEl)
    .setName('Default footer (right)')
    .addText((text) =>
      text
        .setPlaceholder('')
        .setValue(plugin.settings.document.defaultFooterRight)
        .onChange(async (value) => {
          plugin.settings.document.defaultFooterRight = value;
          await plugin.saveSettings();
        }),
    );

  // --- Table of Contents ---
  new Setting(containerEl)
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

  // --- Validation ---
  new Setting(containerEl)
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
