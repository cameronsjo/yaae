import { Setting } from 'obsidian';
import type YaaePlugin from '../../main';

/**
 * Render the Doc Forge settings section into the plugin settings tab.
 */
export function renderDocForgeSettings(
  containerEl: HTMLElement,
  plugin: YaaePlugin,
): void {
  new Setting(containerEl).setName('Doc Forge').setHeading();

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
        .setValue(plugin.settings.docForge.defaultClassification)
        .onChange(async (value) => {
          plugin.settings.docForge.defaultClassification = value as any;
          await plugin.saveSettings();
        }),
    );

  new Setting(containerEl)
    .setName('Show classification banner')
    .setDesc('Display a classification banner in reading view.')
    .addToggle((toggle) =>
      toggle
        .setValue(plugin.settings.docForge.showClassificationBanner)
        .onChange(async (value) => {
          plugin.settings.docForge.showClassificationBanner = value;
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
        .setValue(plugin.settings.docForge.bannerPosition)
        .onChange(async (value) => {
          plugin.settings.docForge.bannerPosition = value as 'top' | 'both';
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
        .setValue(plugin.settings.docForge.defaultWatermarkForDrafts)
        .onChange(async (value) => {
          plugin.settings.docForge.defaultWatermarkForDrafts = value as any;
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
        .setValue(plugin.settings.docForge.defaultHeaderLeft)
        .onChange(async (value) => {
          plugin.settings.docForge.defaultHeaderLeft = value;
          await plugin.saveSettings();
        }),
    );

  new Setting(containerEl)
    .setName('Default header (right)')
    .setDesc('Default right header text for PDF export.')
    .addText((text) =>
      text
        .setPlaceholder('e.g., Department')
        .setValue(plugin.settings.docForge.defaultHeaderRight)
        .onChange(async (value) => {
          plugin.settings.docForge.defaultHeaderRight = value;
          await plugin.saveSettings();
        }),
    );

  new Setting(containerEl)
    .setName('Default footer (left)')
    .addText((text) =>
      text
        .setPlaceholder('')
        .setValue(plugin.settings.docForge.defaultFooterLeft)
        .onChange(async (value) => {
          plugin.settings.docForge.defaultFooterLeft = value;
          await plugin.saveSettings();
        }),
    );

  new Setting(containerEl)
    .setName('Default footer (right)')
    .addText((text) =>
      text
        .setPlaceholder('')
        .setValue(plugin.settings.docForge.defaultFooterRight)
        .onChange(async (value) => {
          plugin.settings.docForge.defaultFooterRight = value;
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
        .setValue(plugin.settings.docForge.tocDepth)
        .setDynamicTooltip()
        .onChange(async (value) => {
          plugin.settings.docForge.tocDepth = value;
          await plugin.saveSettings();
        }),
    );

  // --- Validation ---
  new Setting(containerEl)
    .setName('Validate on save')
    .setDesc('Automatically validate frontmatter when files are saved (warnings to console only).')
    .addToggle((toggle) =>
      toggle
        .setValue(plugin.settings.docForge.validateOnSave)
        .onChange(async (value) => {
          plugin.settings.docForge.validateOnSave = value;
          await plugin.saveSettings();
        }),
    );
}
