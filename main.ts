import { Plugin, PluginSettingTab } from 'obsidian';
import type { Extension } from '@codemirror/state';
import { YaaeSettings, DEFAULT_SETTINGS } from './src/types';
import { POSStyleManager } from './src/prose-highlight/pos-styles';
import { WordListMatcher } from './src/prose-highlight/word-lists';
import { createHighlighterExtension } from './src/prose-highlight/highlighter-plugin';
import { createReadingViewPostProcessor } from './src/prose-highlight/reading-view';
import { renderProseHighlightSettings } from './src/prose-highlight/settings-tab';

export default class YaaePlugin extends Plugin {
  settings: YaaeSettings = DEFAULT_SETTINGS;

  /** Dynamic style manager for POS + custom list colors */
  styleManager = new POSStyleManager();

  /** Shared word list matcher (kept in sync with settings) */
  wordListMatcher = new WordListMatcher();

  /** Mutable array for CM6 editor extension toggle */
  private editorExtensions: Extension[] = [];

  async onload() {
    await this.loadSettings();

    // Dynamic CSS for POS and custom list colors
    this.styleManager.init(this.settings.proseHighlight);

    // Compile word lists from saved settings
    this.wordListMatcher.compile(
      this.settings.proseHighlight.customWordLists,
    );

    // CM6 ViewPlugin for editor / Live Preview highlighting
    const highlighterExt = createHighlighterExtension(this);
    if (this.settings.proseHighlight.enabled) {
      this.editorExtensions.push(highlighterExt);
    }
    this.registerEditorExtension(this.editorExtensions);

    // Reading View post-processor
    this.registerMarkdownPostProcessor(
      createReadingViewPostProcessor(this),
    );

    // Settings tab
    this.addSettingTab(new YaaeSettingTab(this.app, this));

    // Command: toggle prose highlighting
    this.addCommand({
      id: 'toggle-prose-highlighting',
      name: 'Toggle prose highlighting',
      callback: () => {
        this.settings.proseHighlight.enabled =
          !this.settings.proseHighlight.enabled;
        this.saveSettings();
        this.toggleHighlighting(this.settings.proseHighlight.enabled);
      },
    });
  }

  onunload() {
    this.styleManager.destroy();
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData(),
    );
    // Ensure nested defaults exist for upgrades
    this.settings.proseHighlight = Object.assign(
      {},
      DEFAULT_SETTINGS.proseHighlight,
      this.settings.proseHighlight,
    );
    this.settings.proseHighlight.categories = Object.assign(
      {},
      DEFAULT_SETTINGS.proseHighlight.categories,
      this.settings.proseHighlight.categories,
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /** Enable or disable the CM6 editor extension */
  toggleHighlighting(enabled: boolean): void {
    const highlighterExt = createHighlighterExtension(this);
    this.editorExtensions.length = 0;
    if (enabled) {
      this.editorExtensions.push(highlighterExt);
    }
    this.app.workspace.updateOptions();
  }

  /** Trigger decoration rebuild (e.g., after toggling a POS category) */
  refreshHighlighting(): void {
    if (this.settings.proseHighlight.enabled) {
      this.toggleHighlighting(true);
    }
  }

  /** Update dynamic CSS rules (e.g., after changing a color) */
  refreshStyles(): void {
    this.styleManager.update(this.settings.proseHighlight);
  }

  /** Recompile word list regexes after settings change */
  recompileWordLists(): void {
    this.wordListMatcher.compile(
      this.settings.proseHighlight.customWordLists,
    );
  }
}

class YaaeSettingTab extends PluginSettingTab {
  plugin: YaaePlugin;

  constructor(app: any, plugin: YaaePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    renderProseHighlightSettings(containerEl, this.plugin);
  }
}
