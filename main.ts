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
// TODO(#24): typewriter scroll disabled pending fix
// import { typewriterExtension } from './src/cm6/typewriter-scroll';
import { validateMarkdown, deriveCssClasses } from './src/schemas';
import { generateToc } from './src/document/toc-generator';
import { createClassificationBannerProcessor } from './src/document/classification-banner';
import { createStrippedLinksProcessor } from './src/document/stripped-links';
import { createDefangedLinksProcessor } from './src/document/defanged-links';
import { renderDocumentSettings } from './src/document/settings-tab';
import { DEFAULT_DOCUMENT_SETTINGS } from './src/document/settings';
import { createCollapsibleSection } from './src/settings/collapsible-section';
import { DynamicPdfPrintStyleManager, PageChromeManager } from './src/document/print-styles';
import type { PageChromeState } from './src/document/print-styles';
import type { LinksMode } from './src/document/settings';

const BODY_CLASS_SYNTAX_DIMMING = 'yaae-syntax-dimming';
const BODY_CLASS_GUTTERED_HEADINGS = 'yaae-guttered-headings';

const focusCompartment = new Compartment();
// TODO(#24): typewriter scroll disabled pending fix
// const typewriterCompartment = new Compartment();

export default class YaaePlugin extends Plugin {
  settings: YaaeSettings = DEFAULT_SETTINGS;

  /** Dynamic style manager for POS + custom list colors */
  styleManager = new POSStyleManager();

  /** Shared word list matcher (kept in sync with settings) */
  wordListMatcher = new WordListMatcher();

  /** Mutable array for CM6 editor extension toggle */
  private editorExtensions: Extension[] = [];

  /** Dynamic print style manager for fontSize and custom fonts */
  dynamicPdfPrintStyles = new DynamicPdfPrintStyleManager();

  /** @page margin box manager for classification banners, headers, footers, and page numbers */
  pageChromeManager = new PageChromeManager();

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

    // Dynamic print CSS for fontSize, custom fonts, watermarks, and line-height
    this.dynamicPdfPrintStyles.init(this.settings.document);

    // @page margin box manager for classification banners, headers, footers, page numbers
    // NOTE: @page margin boxes require Chrome 131+ (Obsidian ships Chrome 120) — see #29
    this.pageChromeManager.init(this.buildPageChromeState());

    // Update page chrome when active document changes (classification comes from frontmatter)
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        this.updatePageChromeFromActiveFile().catch((err) => {
          console.warn('[yaae] Failed to update page chrome from active file:', err);
        });
      }),
    );

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
    this.dynamicPdfPrintStyles.destroy();
    this.pageChromeManager.destroy();
    document.body.classList.remove(BODY_CLASS_SYNTAX_DIMMING);
    document.body.classList.remove(BODY_CLASS_GUTTERED_HEADINGS);
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
      await this.saveSettings();
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
      // Merge: keep user-defined classes, replace only pdf-* classes
      const existing: string[] = Array.isArray(fm.cssclasses)
        ? fm.cssclasses
        : typeof fm.cssclasses === 'string'
          ? [fm.cssclasses]
          : [];
      const userClasses = existing.filter((c: string) => !c.startsWith('pdf-'));
      fm.cssclasses = [...userClasses, ...classes];
    });

    new Notice(`Applied CSS classes: ${classes.join(', ')}`);
  }

  /** Build PageChromeState from current settings + optional classification override. */
  buildPageChromeState(classification?: string): PageChromeState {
    const doc = this.settings.document;
    return {
      classification: classification ?? doc.defaultClassification,
      customClassifications: doc.customClassifications,
      headerLeft: doc.defaultHeaderLeft,
      headerRight: doc.defaultHeaderRight,
      footerLeft: doc.defaultFooterLeft,
      footerRight: doc.defaultFooterRight,
      pageNumbers: doc.pageNumbers,
      signatureBlock: false,
      bannerPosition: doc.bannerPosition,
      showClassificationBanner: doc.showClassificationBanner,
    };
  }

  /** Read active document's frontmatter and update page chrome with its classification. */
  async updatePageChromeFromActiveFile(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== 'md') {
      this.pageChromeManager.update(this.buildPageChromeState());
      return;
    }

    const content = await this.app.vault.read(file);
    const result = validateMarkdown(content);

    const classification = result.data?.classification ?? this.settings.document.defaultClassification;
    const signatureBlock = result.data?.export?.pdf?.signatureBlock ?? false;

    this.pageChromeManager.update({
      ...this.buildPageChromeState(classification),
      signatureBlock,
    });
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
