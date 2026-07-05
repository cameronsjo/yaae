import { Plugin, PluginSettingTab, App, Setting, MarkdownView, Notice, TFile, Platform } from 'obsidian';
import { Compartment } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { YaaeSettings, DEFAULT_SETTINGS, FocusMode } from './src/types';
import { POSStyleManager } from './src/prose-highlight/pos-styles';
import { WordListMatcher } from './src/prose-highlight/word-lists';
import { createHighlighterExtension } from './src/prose-highlight/highlighter-plugin';
import { createReadingViewPostProcessor } from './src/prose-highlight/reading-view';
import { renderProseHighlightSettings } from './src/prose-highlight/settings-tab';
import { focusExtension } from './src/cm6/focus-mode';
import { gutteredHeadingsExtension } from './src/cm6/guttered-headings';
// TODO(#24): typewriter scroll disabled pending fix
// import { typewriterExtension } from './src/cm6/typewriter-scroll';
import { validateMarkdown, extractFrontmatter } from './src/schemas';
import { generateToc } from './src/document/toc-generator';
import { createClassificationBannerProcessor } from './src/document/classification-banner';
import { createStrippedLinksProcessor } from './src/document/stripped-links';
import { createDefangedLinksProcessor } from './src/document/defanged-links';
import { renderDocumentSettings } from './src/document/settings-tab';
import { DEFAULT_DOCUMENT_SETTINGS } from './src/document/settings';
import { createCollapsibleSection } from './src/settings/collapsible-section';
import { PrintStyleManager } from './src/document/print';
import { buildPrintDocumentState } from './src/document/print/state';
import type { ActiveDocFrontmatter } from './src/document/print/state';
import { PrintProbe } from './src/document/print-probe';
import type { LinksMode } from './src/document/settings';

const BODY_CLASS_SYNTAX_DIMMING = 'yaae-syntax-dimming';

const focusCompartment = new Compartment();
const gutteredHeadingsCompartment = new Compartment();
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

  /**
   * The print pipeline (#28/#29): base + document + chrome style elements,
   * knob values baked from the live cascade, chrome strategy gated on the
   * detected Chrome major. getState() merges settings with the active
   * document's frontmatter overrides (kept fresh by
   * updatePrintStateFromActiveFile).
   */
  printStyles = new PrintStyleManager({
    getState: () => buildPrintDocumentState(this.settings.document, this.activeDoc ?? undefined),
  });

  /** Active document frontmatter (raw + validated) for print-state overrides. */
  private activeDoc: ActiveDocFrontmatter | null = null;

  /** Temporary 3a probe: does class scoping reach the print DOM? (#28/#29) */
  printProbe = new PrintProbe();

  /** Status bar elements for quick toggles */
  private focusModeStatusEl: HTMLElement | null = null;
  private syntaxDimmingStatusEl: HTMLElement | null = null;

  async onload() {
    console.debug('[yaae] onload: starting plugin initialization');
    await this.loadSettings();

    // --- Prose Highlight ---

    // Dynamic CSS for POS and custom list colors. init() may flip the
    // posColorsMigrated latch on first run after upgrading from a pre-
    // light/dark schema; persist that so subsequent reloads skip migration.
    const wasMigrated = this.settings.proseHighlight.posColorsMigrated === true;
    this.styleManager.init(this.settings.proseHighlight);
    if (!wasMigrated && this.settings.proseHighlight.posColorsMigrated) {
      await this.saveSettings();
    }

    // Compile word lists from saved settings
    this.wordListMatcher.compile(
      this.settings.proseHighlight.customWordLists,
    );

    // CM6 ViewPlugin for editor / Live Preview highlighting.
    // Prose highlighting is disabled on mobile pending #32 — it errors / fails
    // to render there. Gate both the editor extension and the Reading View
    // post-processor so the feature is fully off on mobile; desktop is
    // unaffected. registerEditorExtension still runs so the mutable extensions
    // array stays wired for desktop toggling.
    const highlighterExt = createHighlighterExtension(this);
    if (this.settings.proseHighlight.enabled && !Platform.isMobile) {
      this.editorExtensions.push(highlighterExt);
    }
    this.registerEditorExtension(this.editorExtensions);

    // Reading View post-processor
    if (!Platform.isMobile) {
      this.registerMarkdownPostProcessor(
        createReadingViewPostProcessor(this),
      );
    }

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
      gutteredHeadingsCompartment.of(
        this.settings.gutteredHeadings ? gutteredHeadingsExtension() : []
      ),
    ]);

    // --- Commands ---

    this.addCommand({
      id: 'toggle-prose-highlighting',
      name: 'Toggle prose highlighting',
      callback: () => {
        if (Platform.isMobile) {
          new Notice("Prose highlighting isn't available on mobile yet.");
          return;
        }
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
      editorCheckCallback: (checking, _editor) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== 'md') return false;
        if (!checking) this.generateTocForCurrentFile();
        return true;
      },
    });

    // pdf-* classes are runtime-injected now (#28); these commands clean up
    // classes an older version persisted into frontmatter. Stale classes are
    // harmless, so cleanup is offered, not forced.
    this.addCommand({
      id: 'yaae-clean-css-classes',
      name: 'Clean PDF CSS classes from frontmatter',
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== 'md') return false;
        if (checking) return true;
        this.cleanCssClassesFromFile(file).then((changed) => {
          new Notice(changed ? 'Removed pdf-* classes from cssclasses.' : 'No pdf-* classes found.');
        }).catch((err) => {
          console.warn('[yaae] Failed to clean CSS classes:', err);
          new Notice('Failed to clean CSS classes — see console.');
        });
        return true;
      },
    });

    this.addCommand({
      id: 'yaae-clean-css-classes-vault',
      name: 'Clean PDF CSS classes from frontmatter (entire vault)',
      callback: async () => {
        const files = this.app.vault.getMarkdownFiles();
        let cleaned = 0;
        for (const file of files) {
          try {
            if (await this.cleanCssClassesFromFile(file)) cleaned++;
          } catch (err) {
            console.warn(`[yaae] Failed to clean CSS classes. File: ${file.path}`, err);
          }
        }
        console.info(`[yaae] Successfully cleaned pdf-* classes. Files changed: ${cleaned}/${files.length}`);
        new Notice(`Cleaned pdf-* classes from ${cleaned} of ${files.length} notes.`);
      },
    });

    // Temporary #28/#29 empirical gate (3a): decides whether class-scoped
    // print selectors survive into the export DOM. Arm, export a PDF, read
    // the H1 colors, copy the report. Remove once the gate is decided.
    this.addCommand({
      id: 'yaae-debug-print-probe',
      name: 'Toggle print probe (debug)',
      callback: () => {
        if (this.printProbe.active) {
          this.printProbe.disable();
          new Notice('Print probe disarmed.');
          return;
        }
        const viewEl =
          this.app.workspace.getActiveViewOfType(MarkdownView)?.containerEl ??
          null;
        this.printProbe.enable(viewEl);
        new Notice(
          'Print probe ARMED. Export this note to PDF, check the H1: ' +
            'underline only = class scoping dead, red = body-class works, ' +
            'blue = view-class works. Then run "Copy print probe report".',
          10000,
        );
      },
    });

    this.addCommand({
      id: 'yaae-debug-print-probe-report',
      name: 'Copy print probe report (debug)',
      callback: async () => {
        const report = this.printProbe.buildReport();
        try {
          await navigator.clipboard.writeText(report);
          new Notice('Print probe report copied to clipboard.');
        } catch (err) {
          console.error('[yaae] Failed to copy probe report. Dumping to console:', err);
          console.info(report);
          new Notice('Clipboard unavailable — probe report dumped to the developer console.');
        }
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

    // Print pipeline: base (bundled CSS, knobs baked) + document (per-doc
    // state-baked rules) + chrome (banners/headers/footers/page numbers,
    // strategy gated on Chrome >= 131 — see #29). There is no before-print
    // hook in Obsidian's API, so the elements stay continuously correct via
    // the listeners below.
    this.printStyles.init();

    // Style Settings (and theme) edits move the --yaae-print-* knobs;
    // re-resolve and re-bake on every css-change.
    this.registerEvent(
      this.app.workspace.on('css-change', () => {
        this.printStyles.refresh();
      }),
    );

    // Active document changes: classification + per-doc overrides come from
    // frontmatter.
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        this.updatePrintStateFromActiveFile().catch((err) => {
          console.warn('[yaae] Failed to update print state from active file:', err);
        });
      }),
    );

    // Frontmatter edits WITHOUT a leaf change previously left stale chrome —
    // refresh when the active file's metadata changes.
    this.registerEvent(
      this.app.metadataCache.on('changed', (file) => {
        if (file !== this.app.workspace.getActiveFile()) return;
        this.updatePrintStateFromActiveFile().catch((err) => {
          console.warn('[yaae] Failed to refresh print state after metadata change:', err);
        });
      }),
    );

    // Bootstrap from the currently-active file. active-leaf-change does not
    // fire for the leaf already open at startup, so without this the print
    // state would reflect default classification instead of the open
    // document's frontmatter.
    this.app.workspace.onLayoutReady(() => {
      this.updatePrintStateFromActiveFile().catch((err) => {
        console.warn('[yaae] Failed to bootstrap print state from active file:', err);
      });
    });

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

    // Validate on save. Listener is always registered; gate the work on the
    // *current* setting value so toggling validateOnSave in the UI takes
    // effect without requiring a plugin reload.
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (!this.settings.document.validateOnSave) return;
        if (file instanceof TFile && file.extension === 'md') {
          this.validateFileQuietly(file);
        }
      }),
    );

    // Settings tab
    this.addSettingTab(new YaaeSettingTab(this.app, this));
    console.debug('[yaae] onload: plugin initialization complete');
  }

  onunload() {
    console.debug('[yaae] onunload: tearing down plugin');
    this.styleManager.destroy();
    this.printStyles.destroy();
    this.printProbe.disable();
    document.body.classList.remove(BODY_CLASS_SYNTAX_DIMMING);
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

    // Defensive: a corrupt or hand-edited data.json can land here with
    // arrays set to null, strings, or other non-arrays (Object.assign
    // shallow-merges and won't restore the default []). Reset critical
    // arrays so downstream code can safely .map / .filter.
    if (!Array.isArray(this.settings.document.customClassifications)) {
      this.settings.document.customClassifications = [];
    }

    // Migrate deprecated expandLinks/plainLinks booleans to links enum
    const doc = this.settings.document;
    if (doc.links === 'expand' && (doc.plainLinks || !doc.expandLinks)) {
      if (doc.plainLinks) {
        doc.links = 'plain' as LinksMode;
      } else if (!doc.expandLinks) {
        doc.links = 'styled' as LinksMode;
      }
      console.info(
        `[yaae] Migrated deprecated link booleans to links enum. ` +
        `expandLinks: ${doc.expandLinks}, plainLinks: ${doc.plainLinks} → links: ${doc.links}`,
      );
      // Persist after loadSettings resolves — don't await inside the loader.
      queueMicrotask(() => {
        this.saveSettings().catch((err) => {
          console.warn('[yaae] Failed to persist link enum migration:', err);
        });
      });
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // --- Prose Highlight Methods ---

  /** Enable or disable the CM6 editor extension. No-op on mobile (#32). */
  toggleHighlighting(enabled: boolean): void {
    const highlighterExt = createHighlighterExtension(this);
    this.editorExtensions.length = 0;
    if (enabled && !Platform.isMobile) {
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

  reconfigureGutteredHeadings() {
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView) {
        const cm = (leaf.view.editor as any).cm;
        if (cm) {
          cm.dispatch({
            effects: gutteredHeadingsCompartment.reconfigure(
              this.settings.gutteredHeadings ? gutteredHeadingsExtension() : []
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
    this.reconfigureGutteredHeadings();
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
    if (!(file instanceof TFile)) return;
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
    } else {
      console.debug(`[yaae] ${file.path}: frontmatter valid`);
    }
  }

  async generateTocForCurrentFile() {
    const file = this.app.workspace.getActiveFile();
    if (!file) return;
    if (!(file instanceof TFile)) return;
    const content = await this.app.vault.read(file);

    // Race guard: if the user switched files during the read, do NOT modify
    // the file we started with — that would write a TOC for the previous
    // document into the now-active one. Bail with a debug message.
    if (this.app.workspace.getActiveFile() !== file) {
      console.debug('[yaae] TOC abort: active file changed mid-read');
      return;
    }

    // Get TOC depth from frontmatter or settings
    const fmResult = validateMarkdown(content);
    const depth = fmResult.data?.export?.pdf?.tocDepth ?? this.settings.document.tocDepth;

    const { content: updated, entryCount } = generateToc(content, depth);
    await this.app.vault.modify(file, updated);
    console.info(`[yaae] Successfully generated TOC. File: ${file.path}, Entries: ${entryCount}, Depth: ${depth}`);
    new Notice(`Table of Contents generated with ${entryCount} entries`);
  }

  /**
   * Strip pdf-* entries from a file's cssclasses frontmatter. Migration
   * cleanup for the retired "Apply CSS classes" flow (#28) — classes are now
   * injected at runtime, never persisted. Stale classes are harmless, so
   * this is offered, not forced. Returns true when the file changed.
   */
  async cleanCssClassesFromFile(file: TFile): Promise<boolean> {
    let changed = false;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      // Defensive: cssclasses may be a single string, array, or array with
      // non-string entries — filter to strings before startsWith().
      const existing: unknown[] = Array.isArray(fm.cssclasses)
        ? fm.cssclasses
        : typeof fm.cssclasses === 'string'
          ? [fm.cssclasses]
          : [];
      const userClasses = existing.filter(
        (c): c is string => typeof c === 'string' && !c.startsWith('pdf-'),
      );
      if (userClasses.length === existing.length) return;
      changed = true;
      if (userClasses.length > 0) {
        fm.cssclasses = userClasses;
      } else {
        delete fm.cssclasses;
      }
    });
    return changed;
  }

  /**
   * Read the active document's frontmatter (raw + validated) and refresh the
   * print pipeline with its overrides.
   *
   * Race-aware: if the active file changes during the async vault.read,
   * we abort the update so the state doesn't reflect a stale file.
   *
   * Non-markdown active leaves (PDF, canvas, image preview) leave the
   * state untouched so the last markdown classification is preserved
   * for export.
   */
  async updatePrintStateFromActiveFile(): Promise<void> {
    const startFile = this.app.workspace.getActiveFile();
    if (!startFile) {
      // No active file at all — fall back to defaults so the pipeline
      // reflects settings.
      this.activeDoc = null;
      this.printStyles.refresh();
      return;
    }
    if (startFile.extension !== 'md') {
      // Active leaf is non-markdown (e.g., embedded PDF, canvas). Leave the
      // existing print state alone so the last markdown file's
      // classification is preserved for export.
      return;
    }

    const content = await this.app.vault.read(startFile);

    // Race guard: if the user switched files during the read, the print state
    // should reflect the *new* active file (or be left alone), not the file we
    // started reading. Bail and let the next active-leaf-change re-trigger us.
    if (this.app.workspace.getActiveFile() !== startFile) {
      console.debug('[yaae] updatePrintStateFromActiveFile: active file changed mid-read, aborting');
      return;
    }

    this.activeDoc = {
      raw: extractFrontmatter(content),
      validated: validateMarkdown(content).data,
    };
    this.printStyles.refresh();
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
      // PluginSettingTab does not extend Component, so `this.registerDomEvent`
      // is unavailable here. Route through the plugin (Plugin extends Component)
      // so the listener is detached on plugin unload.
      this.plugin.registerDomEvent(btn, 'click', () => {
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
          this.plugin.reconfigureGutteredHeadings();
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
    new Setting(containerEl).setName('YAAE').setDesc('Why Author Anywhere Else').setHeading();

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
