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
import { validateMarkdown, deriveCssClasses } from './src/schemas';
import { generateToc } from './src/document/toc-generator';
import { createClassificationBannerProcessor } from './src/document/classification-banner';
import { createStrippedLinksProcessor } from './src/document/stripped-links';
import { createDefangedLinksProcessor } from './src/document/defanged-links';
import { renderDocumentSettings } from './src/document/settings-tab';
import { DEFAULT_DOCUMENT_SETTINGS } from './src/document/settings';
import { createCollapsibleSection } from './src/settings/collapsible-section';
import { ClassificationPrintStyleManager, HeaderFooterPrintStyleManager, DynamicPdfPrintStyleManager } from './src/document/print-styles';
import type { LinksMode } from './src/document/settings';

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

  /** Dynamic print style manager for custom classification banners */
  classificationPrintStyles = new ClassificationPrintStyleManager();

  /** Dynamic print style manager for page headers and footers */
  headerFooterPrintStyles = new HeaderFooterPrintStyleManager();

  /** Dynamic print style manager for fontSize and custom fonts */
  dynamicPdfPrintStyles = new DynamicPdfPrintStyleManager();

  /** Status bar elements for quick toggles */
  private focusModeStatusEl: HTMLElement | null = null;
  private syntaxDimmingStatusEl: HTMLElement | null = null;

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

    // --- Document Commands ---

    this.addCommand({
      id: 'yaae-validate',
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
      id: 'yaae-generate-toc',
      name: 'Generate table of contents',
      editorCheckCallback: (checking, editor) => {
        if (checking) return true;
        this.generateTocForCurrentFile();
        return true;
      },
    });

    this.addCommand({
      id: 'yaae-apply-css-classes',
      name: 'Apply CSS classes from frontmatter',
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== 'md') return false;
        if (checking) return true;
        this.applyCssClassesFromFrontmatter();
        return true;
      },
    });

    // --- Status Bar Toggles ---

    this.focusModeStatusEl = this.addStatusBarItem();
    this.focusModeStatusEl.addClass('yaae-statusbar-toggle');
    this.updateFocusModeStatus();
    this.registerDomEvent(this.focusModeStatusEl, 'click', () => {
      this.cycleFocusMode();
    });

    this.syntaxDimmingStatusEl = this.addStatusBarItem();
    this.syntaxDimmingStatusEl.addClass('yaae-statusbar-toggle');
    this.updateSyntaxDimmingStatus();
    this.registerDomEvent(this.syntaxDimmingStatusEl, 'click', () => {
      this.toggleSyntaxDimming();
    });

    // --- Document Auto-Behaviors ---

    // Dynamic print CSS for custom classification banners, headers/footers, and PDF appearance
    this.classificationPrintStyles.init(this.settings.document.customClassifications);
    this.headerFooterPrintStyles.init(this.settings.document);
    this.dynamicPdfPrintStyles.init(this.settings.document);

    // Classification banner in reading view (always registered; checks setting at runtime)
    this.registerMarkdownPostProcessor(
      createClassificationBannerProcessor(() => this.settings.document),
    );

    // Stripped links processor (always registered; checks links mode at runtime)
    this.registerMarkdownPostProcessor(
      createStrippedLinksProcessor(() => this.settings.document),
    );

    // Defanged links processor (always registered; checks links mode at runtime)
    this.registerMarkdownPostProcessor(
      createDefangedLinksProcessor(() => this.settings.document),
    );

    // Validate on save
    if (this.settings.document.validateOnSave) {
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
    this.classificationPrintStyles.destroy();
    this.headerFooterPrintStyles.destroy();
    this.dynamicPdfPrintStyles.destroy();
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
    this.settings.document = Object.assign(
      {},
      DEFAULT_DOCUMENT_SETTINGS,
      this.settings.document,
    );

    // Migrate deprecated expandLinks/plainLinks booleans to links enum
    const doc = this.settings.document;
    if (doc.links === 'expand' && (doc.plainLinks || !doc.expandLinks)) {
      const previousLinks = doc.links;
      if (doc.plainLinks) {
        doc.links = 'plain' as LinksMode;
      } else if (!doc.expandLinks) {
        doc.links = 'styled' as LinksMode;
      }
      console.info(
        `[yaae] Migrated deprecated link booleans to links enum. ` +
        `expandLinks: ${doc.expandLinks}, plainLinks: ${doc.plainLinks} → links: ${doc.links}`,
      );
    }
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
    this.updateSyntaxDimmingStatus();
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
    this.updateFocusModeStatus();
    await this.saveSettings();
  }

  async toggleTypewriterScroll() {
    this.settings.typewriterScroll = !this.settings.typewriterScroll;
    this.reconfigureTypewriter();
    await this.saveSettings();
  }

  // --- Status Bar Methods ---

  updateFocusModeStatus() {
    if (!this.focusModeStatusEl) return;
    const labels: Record<FocusMode, string> = {
      off: 'Focus: Off',
      sentence: 'Focus: Sentence',
      paragraph: 'Focus: Paragraph',
    };
    this.focusModeStatusEl.setText(labels[this.settings.focusMode]);
    this.focusModeStatusEl.ariaLabel = 'Click to cycle focus mode';
  }

  updateSyntaxDimmingStatus() {
    if (!this.syntaxDimmingStatusEl) return;
    this.syntaxDimmingStatusEl.setText(
      this.settings.syntaxDimming ? 'Syntax: Dim' : 'Syntax: Off',
    );
    this.syntaxDimmingStatusEl.ariaLabel = 'Click to toggle syntax dimming';
  }

  // --- Document Methods ---

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
      console.warn(`[yaae] ${file.path}: validation errors`, result.errors?.issues);
    } else if (result.warnings.length > 0) {
      console.warn(`[yaae] ${file.path}: warnings`, result.warnings);
    }
  }

  async generateTocForCurrentFile() {
    const file = this.app.workspace.getActiveFile();
    if (!file) return;
    const content = await this.app.vault.read(file);

    // Get TOC depth from frontmatter or settings
    const fmResult = validateMarkdown(content);
    const depth = fmResult.data?.export?.pdf?.tocDepth ?? this.settings.document.tocDepth;

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

type SettingsTab = 'writing' | 'document' | 'about';

class YaaeSettingTab extends PluginSettingTab {
  plugin: YaaePlugin;
  private activeTab: SettingsTab = 'writing';
  private expandedSections = new Set<string>();

  constructor(app: App, plugin: YaaePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('yaae-settings');

    // --- Tab Navigation ---
    const nav = containerEl.createDiv('yaae-settings-nav');
    const tabs: { id: SettingsTab; label: string }[] = [
      { id: 'writing', label: 'Writing' },
      { id: 'document', label: 'Document' },
      { id: 'about', label: 'About' },
    ];

    for (const tab of tabs) {
      const btn = nav.createEl('button', {
        text: tab.label,
        cls: `yaae-settings-tab${this.activeTab === tab.id ? ' is-active' : ''}`,
      });
      btn.addEventListener('click', () => {
        this.activeTab = tab.id;
        this.display();
      });
    }

    // --- Tab Content ---
    const content = containerEl.createDiv('yaae-settings-content');

    switch (this.activeTab) {
      case 'writing':
        this.renderWritingTab(content);
        break;
      case 'document':
        renderDocumentSettings(content, this.plugin, this.expandedSections);
        break;
      case 'about':
        this.renderAboutTab(content);
        break;
    }
  }

  private renderWritingTab(containerEl: HTMLElement): void {
    // Prose highlight settings (renders its own collapsible sections)
    renderProseHighlightSettings(containerEl, this.plugin, this.expandedSections);

    // Readability settings
    const readabilityContent = createCollapsibleSection(
      containerEl, this.expandedSections, 'writing-readability', 'Readability', true,
    );

    new Setting(readabilityContent)
      .setName('Syntax dimming')
      .setDesc(
        'Reduce opacity of markdown formatting characters (**, *, #, etc.) while keeping them visible.'
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.syntaxDimming).onChange(async (value) => {
          this.plugin.settings.syntaxDimming = value;
          this.plugin.applyBodyClasses();
          this.plugin.updateSyntaxDimmingStatus();
          await this.plugin.saveSettings();
        })
      );

    new Setting(readabilityContent)
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

    new Setting(readabilityContent)
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
            this.plugin.updateFocusModeStatus();
            await this.plugin.saveSettings();
          })
      );

    new Setting(readabilityContent)
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
  }

  private renderAboutTab(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'YAAE' });
    containerEl.createEl('p', {
      text: 'Why Author Anywhere Else',
      cls: 'setting-item-description',
    });

    new Setting(containerEl)
      .setName('Version')
      .setDesc(this.plugin.manifest.version);

    new Setting(containerEl)
      .setName('Author')
      .setDesc(this.plugin.manifest.author);

    if (this.plugin.manifest.authorUrl) {
      new Setting(containerEl)
        .setName('GitHub')
        .addButton((btn) =>
          btn.setButtonText('Open').onClick(() => {
            window.open(this.plugin.manifest.authorUrl!, '_blank');
          }),
        );
    }

    new Setting(containerEl)
      .setName('Description')
      .setDesc(this.plugin.manifest.description);
  }
}
