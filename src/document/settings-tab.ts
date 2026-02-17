import { Setting } from 'obsidian';
import type YaaePlugin from '../../main';

/**
 * Render the Document settings section into the plugin settings tab.
 */
export function renderDocumentSettings(
  containerEl: HTMLElement,
  plugin: YaaePlugin,
): void {
  new Setting(containerEl).setName('Document').setHeading();

  // --- Classification ---
  new Setting(containerEl)
    .setName('Default classification')
    .setDesc('Classification level applied to new documents.')
    .addDropdown((dropdown) =>
      dropdown
        .addOption('public', 'Public')
        .addOption('internal', 'Internal')
        .addOption('confidential', 'Confidential')
        .addOption('restricted', 'Restricted')
        .setValue(plugin.settings.document.defaultClassification)
        .onChange(async (value) => {
          plugin.settings.document.defaultClassification = value as any;
          await plugin.saveSettings();
        }),
    );

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
