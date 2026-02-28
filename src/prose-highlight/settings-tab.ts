import { Setting } from 'obsidian';
import type YaaePlugin from '../../main';
import { POS_CATEGORIES, DEFAULT_POS_COLORS } from '../types';
import type { POSCategory, CustomWordList } from '../types';
import { createCollapsibleSection } from '../settings/collapsible-section';

/** Human-readable labels for POS categories */
const POS_LABELS: Record<POSCategory, string> = {
  adjective: 'Adjectives',
  noun: 'Nouns',
  adverb: 'Adverbs',
  verb: 'Verbs',
  conjunction: 'Conjunctions',
};

/**
 * Adds prose highlighting settings to a container element.
 * Called from the main plugin's PluginSettingTab.display().
 */
export function renderProseHighlightSettings(
  containerEl: HTMLElement,
  plugin: YaaePlugin,
  expandedSections: Set<string>,
): void {
  const settings = plugin.settings.proseHighlight;

  // --- Prose Highlighting section ---
  const proseContent = createCollapsibleSection(
    containerEl, expandedSections, 'writing-prose', 'Prose Highlighting', true,
  );

  proseContent.createEl('p', {
    text: 'Color-code words by part of speech, inspired by iA Writer.',
    cls: 'setting-item-description',
  });

  // Master toggle
  new Setting(proseContent)
    .setName('Enable prose highlighting')
    .setDesc('Color-code adjectives, nouns, adverbs, verbs, and conjunctions in the editor.')
    .addToggle((toggle) =>
      toggle.setValue(settings.enabled).onChange(async (value) => {
        settings.enabled = value;
        await plugin.saveSettings();
        plugin.toggleHighlighting(value);
      }),
    );

  // Reading View toggle
  new Setting(proseContent)
    .setName('Highlight in Reading View')
    .setDesc('Also apply prose highlighting when viewing notes in Reading View.')
    .addToggle((toggle) =>
      toggle
        .setValue(settings.readingViewEnabled)
        .onChange(async (value) => {
          settings.readingViewEnabled = value;
          await plugin.saveSettings();
        }),
    );

  // --- Parts of Speech section ---
  const posContent = createCollapsibleSection(
    containerEl, expandedSections, 'writing-pos', 'Parts of Speech',
  );

  for (const cat of POS_CATEGORIES) {
    const catSettings = settings.categories[cat];

    const setting = new Setting(posContent)
      .setName(POS_LABELS[cat])
      .addToggle((toggle) =>
        toggle.setValue(catSettings.enabled).onChange(async (value) => {
          catSettings.enabled = value;
          await plugin.saveSettings();
          plugin.refreshHighlighting();
        }),
      );

    // Color picker via native <input type="color">
    const colorInput = setting.controlEl.createEl('input', {
      type: 'color',
      value: catSettings.color,
    });
    colorInput.style.marginLeft = '8px';
    colorInput.style.cursor = 'pointer';
    colorInput.addEventListener('input', async () => {
      catSettings.color = colorInput.value;
      await plugin.saveSettings();
      plugin.refreshStyles();
    });

    // Reset color button
    if (catSettings.color !== DEFAULT_POS_COLORS[cat]) {
      setting.addButton((btn) =>
        btn.setButtonText('Reset').onClick(async () => {
          catSettings.color = DEFAULT_POS_COLORS[cat];
          colorInput.value = DEFAULT_POS_COLORS[cat];
          await plugin.saveSettings();
          plugin.refreshStyles();
        }),
      );
    }
  }

  // --- Custom Word Lists section ---
  const wordListContent = createCollapsibleSection(
    containerEl, expandedSections, 'writing-wordlists', 'Custom Word Lists',
  );

  wordListContent.createEl('p', {
    text: 'Define named groups of words to highlight with custom colors.',
    cls: 'setting-item-description',
  });

  renderCustomWordLists(wordListContent, plugin);
}

function renderCustomWordLists(
  containerEl: HTMLElement,
  plugin: YaaePlugin,
): void {
  const settings = plugin.settings.proseHighlight;
  const listContainer = containerEl.createDiv('yaae-word-lists-container');

  function redraw() {
    listContainer.empty();

    for (let i = 0; i < settings.customWordLists.length; i++) {
      const list = settings.customWordLists[i];
      renderWordListEntry(listContainer, plugin, list, i, redraw);
    }

    // Add list button
    new Setting(listContainer)
      .setName('Add word list')
      .addButton((btn) =>
        btn.setButtonText('+ New List').setCta().onClick(async () => {
          settings.customWordLists.push({
            name: `List ${settings.customWordLists.length + 1}`,
            words: [],
            color: '#666666',
            enabled: true,
            caseSensitive: false,
          });
          await plugin.saveSettings();
          plugin.refreshStyles();
          plugin.recompileWordLists();
          redraw();
        }),
      );
  }

  redraw();
}

function renderWordListEntry(
  containerEl: HTMLElement,
  plugin: YaaePlugin,
  list: CustomWordList,
  index: number,
  redraw: () => void,
): void {
  const settings = plugin.settings.proseHighlight;
  const wrapper = containerEl.createDiv('yaae-word-list-entry');
  wrapper.style.border = '1px solid var(--background-modifier-border)';
  wrapper.style.borderRadius = '8px';
  wrapper.style.padding = '12px';
  wrapper.style.marginBottom = '12px';

  // Header row: name + toggle + color + delete
  const header = new Setting(wrapper)
    .setName(list.name)
    .addToggle((toggle) =>
      toggle.setValue(list.enabled).onChange(async (value) => {
        list.enabled = value;
        await plugin.saveSettings();
        plugin.refreshHighlighting();
        plugin.recompileWordLists();
      }),
    );

  // Color picker
  const colorInput = header.controlEl.createEl('input', {
    type: 'color',
    value: list.color,
  });
  colorInput.style.marginLeft = '8px';
  colorInput.style.cursor = 'pointer';
  colorInput.addEventListener('input', async () => {
    list.color = colorInput.value;
    await plugin.saveSettings();
    plugin.refreshStyles();
  });

  // Delete button
  header.addButton((btn) =>
    btn
      .setIcon('trash')
      .setWarning()
      .onClick(async () => {
        settings.customWordLists.splice(index, 1);
        await plugin.saveSettings();
        plugin.refreshStyles();
        plugin.recompileWordLists();
        plugin.refreshHighlighting();
        redraw();
      }),
  );

  // List name editor
  new Setting(wrapper).setName('Name').addText((text) =>
    text.setValue(list.name).onChange(async (value) => {
      list.name = value;
      await plugin.saveSettings();
      plugin.refreshStyles();
      plugin.recompileWordLists();
    }),
  );

  // Words editor (textarea)
  new Setting(wrapper)
    .setName('Words')
    .setDesc('One word or phrase per line, or comma-separated.')
    .addTextArea((area) => {
      area.inputEl.style.width = '100%';
      area.inputEl.style.minHeight = '80px';
      area.inputEl.rows = 4;
      area
        .setValue(list.words.join('\n'))
        .onChange(async (value) => {
          // Split on newlines or commas, trim whitespace
          list.words = value
            .split(/[\n,]/)
            .map((w) => w.trim())
            .filter((w) => w.length > 0);
          await plugin.saveSettings();
          plugin.recompileWordLists();
          plugin.refreshHighlighting();
        });
    });

  // Case sensitivity toggle
  new Setting(wrapper)
    .setName('Case sensitive')
    .setDesc('Match exact capitalization.')
    .addToggle((toggle) =>
      toggle.setValue(list.caseSensitive).onChange(async (value) => {
        list.caseSensitive = value;
        await plugin.saveSettings();
        plugin.recompileWordLists();
        plugin.refreshHighlighting();
      }),
    );
}
