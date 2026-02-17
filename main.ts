import { Plugin, PluginSettingTab, App, Setting, MarkdownView, Notice, TFile } from 'obsidian';
import { Compartment } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { YaaeSettings, DEFAULT_SETTINGS, FocusMode } from './src/types';
import { POSStyleManager } from './src/prose-highlight/pos-styles';
import { WordListMatcher } from './src/prose-highlight/word-lists';
import { createHighlighterExtension } from './src/prose-highlight/highlighter-plugin';
import { createReadingViewPostProcessor } from './src/prose-highlight/reading-view';
import { renderProseHighlightSettings } from './src/prose-highlight/settings-tab';
import { focusExtension } from './src/cm6/focus-mode';
import { typewriterExtension } from './src/cm6/typewriter-scroll';
import { validateMarkdown, deriveCssClasses } from '@doc-forge/schemas';
import { generateToc } from './src/doc-forge/toc-generator';
import { classificationBannerProcessor } from './src/doc-forge/classification-banner';
import { renderDocForgeSettings } from './src/doc-forge/settings-tab';
import { DEFAULT_DOC_FORGE_SETTINGS } from './src/doc-forge/settings';

const BODY_CLASS_SYNTAX_DIMMING = 'yaae-syntax-dimming';
const BODY_CLASS_GUTTERED_HEADINGS = 'yaae-guttered-headings';

const focusCompartment = new Compartment();
const typewriterCompartment = new Compartment();

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

    // --- Prose Highlight ---

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

    // --- Readability Features ---

    // CSS features: toggle body classes
    this.applyBodyClasses();

    // CM6 features: register via Compartment
    this.registerEditorExtension([
      focusCompartment.of(
        this.settings.focusMode !== 'off'
          ? focusExtension(this.settings.focusMode)
          : []
      ),
      typewriterCompartment.of(
        this.settings.typewriterScroll ? typewriterExtension() : []
      ),
    ]);

    // --- Commands ---

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

    this.addCommand({
      id: 'toggle-syntax-dimming',
      name: 'Toggle syntax dimming',
      callback: () => this.toggleSyntaxDimming(),
    });

    this.addCommand({
      id: 'toggle-guttered-headings',
      name: 'Toggle guttered headings',
      callback: () => this.toggleGutteredHeadings(),
    });

    this.addCommand({
      id: 'cycle-focus-mode',
      name: 'Cycle focus mode',
      callback: () => this.cycleFocusMode(),
    });

    this.addCommand({
      id: 'toggle-typewriter-scroll',
      name: 'Toggle typewriter scroll',
      callback: () => this.toggleTypewriterScroll(),
    });

    // --- Doc Forge Commands ---

    this.addCommand({
      id: 'doc-forge-validate',
      name: 'Validate frontmatter',
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== 'md') return false;
        if (checking) return true;
        this.validateCurrentFile();
        return true;
      },
    });

    this.addCommand({
      id: 'doc-forge-generate-toc',
      name: 'Generate table of contents',
      editorCheckCallback: (checking, editor) => {
        if (checking) return true;
        this.generateTocForCurrentFile();
        return true;
      },
    });

    this.addCommand({
      id: 'doc-forge-apply-css-classes',
      name: 'Apply CSS classes from frontmatter',
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== 'md') return false;
        if (checking) return true;
        this.applyCssClassesFromFrontmatter();
        return true;
      },
    });

    // --- Doc Forge Auto-Behaviors ---

    // Classification banner in reading view
    if (this.settings.docForge.showClassificationBanner) {
      this.registerMarkdownPostProcessor(classificationBannerProcessor);
    }

    // Validate on save
    if (this.settings.docForge.validateOnSave) {
      this.registerEvent(
        this.app.vault.on('modify', (file) => {
          if (file instanceof TFile && file.extension === 'md') {
            this.validateFileQuietly(file);
          }
        }),
      );
    }

    // Settings tab
    this.addSettingTab(new YaaeSettingTab(this.app, this));
  }

  onunload() {
    this.styleManager.destroy();
    document.body.classList.remove(BODY_CLASS_SYNTAX_DIMMING);
    document.body.classList.remove(BODY_CLASS_GUTTERED_HEADINGS);
    this.removeTypewriterPadding();
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
    this.settings.docForge = Object.assign(
      {},
      DEFAULT_DOC_FORGE_SETTINGS,
      this.settings.docForge,
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // --- Prose Highlight Methods ---

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

  // --- Readability Methods ---

  applyBodyClasses() {
    document.body.classList.toggle(
      BODY_CLASS_SYNTAX_DIMMING,
      this.settings.syntaxDimming
    );
    document.body.classList.toggle(
      BODY_CLASS_GUTTERED_HEADINGS,
      this.settings.gutteredHeadings
    );
  }

  reconfigureFocus() {
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView) {
        const cm = (leaf.view.editor as any).cm;
        if (cm) {
          cm.dispatch({
            effects: focusCompartment.reconfigure(
              this.settings.focusMode !== 'off'
                ? focusExtension(this.settings.focusMode)
                : []
            ),
          });
        }
      }
    });
  }

  reconfigureTypewriter() {
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView) {
        const cm = (leaf.view.editor as any).cm;
        if (cm) {
          cm.dispatch({
            effects: typewriterCompartment.reconfigure(
              this.settings.typewriterScroll ? typewriterExtension() : []
            ),
          });
        }
      }
    });
    if (!this.settings.typewriterScroll) {
      this.removeTypewriterPadding();
    }
  }

  removeTypewriterPadding() {
    document.querySelectorAll('.cm-sizer').forEach((el) => {
      (el as HTMLElement).style.paddingBottom = '';
    });
  }

  async toggleSyntaxDimming() {
    this.settings.syntaxDimming = !this.settings.syntaxDimming;
    this.applyBodyClasses();
    await this.saveSettings();
  }

  async toggleGutteredHeadings() {
    this.settings.gutteredHeadings = !this.settings.gutteredHeadings;
    this.applyBodyClasses();
    await this.saveSettings();
  }

  async cycleFocusMode() {
    const cycle: FocusMode[] = ['off', 'sentence', 'paragraph'];
    const idx = cycle.indexOf(this.settings.focusMode);
    this.settings.focusMode = cycle[(idx + 1) % cycle.length];
    this.reconfigureFocus();
    await this.saveSettings();
  }

  async toggleTypewriterScroll() {
    this.settings.typewriterScroll = !this.settings.typewriterScroll;
    this.reconfigureTypewriter();
    await this.saveSettings();
  }

  // --- Doc Forge Methods ---

  async validateCurrentFile() {
    const file = this.app.workspace.getActiveFile();
    if (!file) return;
    const content = await this.app.vault.read(file);
    const result = validateMarkdown(content);

    if (result.valid) {
      const parts = [`Frontmatter valid (${result.schema} schema)`];
      if (result.warnings.length > 0) {
        parts.push(`\nWarnings:\n${result.warnings.map((w) => `  - ${w}`).join('\n')}`);
        new Notice(parts.join(''), 8000);
      } else {
        new Notice(parts[0]);
      }
    } else {
      const errors = result.errors?.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n') ?? '';
      new Notice(`Frontmatter invalid (${result.schema} schema)\n${errors}`, 10000);
    }
  }

  async validateFileQuietly(file: TFile) {
    const content = await this.app.vault.read(file);
    const result = validateMarkdown(content);
    if (!result.valid) {
      console.warn(`[doc-forge] ${file.path}: validation errors`, result.errors?.issues);
    } else if (result.warnings.length > 0) {
      console.warn(`[doc-forge] ${file.path}: warnings`, result.warnings);
    }
  }

  async generateTocForCurrentFile() {
    const file = this.app.workspace.getActiveFile();
    if (!file) return;
    const content = await this.app.vault.read(file);

    // Get TOC depth from frontmatter or settings
    const fmResult = validateMarkdown(content);
    const depth = fmResult.data?.export?.pdf?.tocDepth ?? this.settings.docForge.tocDepth;

    const { content: updated, entryCount } = generateToc(content, depth);
    await this.app.vault.modify(file, updated);
    new Notice(`Table of Contents generated with ${entryCount} entries`);
  }

  async applyCssClassesFromFrontmatter() {
    const file = this.app.workspace.getActiveFile();
    if (!file) return;
    const content = await this.app.vault.read(file);
    const result = validateMarkdown(content);

    if (!result.valid || !result.data) {
      new Notice('Cannot derive CSS classes — frontmatter is invalid.');
      return;
    }

    const classes = deriveCssClasses(result.data);

    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.cssclass = classes;
    });

    new Notice(`Applied CSS classes: ${classes.join(', ')}`);
  }
}

class YaaeSettingTab extends PluginSettingTab {
  plugin: YaaePlugin;

  constructor(app: App, plugin: YaaePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Prose highlight settings (from prose-highlight/settings-tab.ts)
    renderProseHighlightSettings(containerEl, this.plugin);

    // Readability settings
    new Setting(containerEl).setName('Readability').setHeading();

    new Setting(containerEl)
      .setName('Syntax dimming')
      .setDesc(
        'Reduce opacity of markdown formatting characters (**, *, #, etc.) while keeping them visible.'
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.syntaxDimming).onChange(async (value) => {
          this.plugin.settings.syntaxDimming = value;
          this.plugin.applyBodyClasses();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Guttered headings')
      .setDesc(
        'Outdent # heading markers into the left gutter so heading text aligns with body text.'
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.gutteredHeadings).onChange(async (value) => {
          this.plugin.settings.gutteredHeadings = value;
          this.plugin.applyBodyClasses();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Focus mode')
      .setDesc(
        'Dim all text except the active sentence or paragraph.'
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption('off', 'Off')
          .addOption('sentence', 'Sentence')
          .addOption('paragraph', 'Paragraph')
          .setValue(this.plugin.settings.focusMode)
          .onChange(async (value) => {
            this.plugin.settings.focusMode = value as FocusMode;
            this.plugin.reconfigureFocus();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Typewriter scroll')
      .setDesc(
        'Keep the cursor vertically centered in the viewport as you type.'
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.typewriterScroll)
          .onChange(async (value) => {
            this.plugin.settings.typewriterScroll = value;
            this.plugin.reconfigureTypewriter();
            await this.plugin.saveSettings();
          })
      );

    // Doc Forge settings
    renderDocForgeSettings(containerEl, this.plugin);
  }
}
