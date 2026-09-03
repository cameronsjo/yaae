import { Plugin, PluginSettingTab, type App, Setting, MarkdownView, Notice, TFile, Platform } from 'obsidian';
import { Compartment } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { type YaaeSettings, DEFAULT_SETTINGS, type FocusMode } from './src/types';
import { POSStyleManager } from './src/prose-highlight/pos-styles';
import { WordListMatcher } from './src/prose-highlight/word-lists';
import { createHighlighterExtension } from './src/prose-highlight/highlighter-plugin';
import { createReadingViewPostProcessor } from './src/prose-highlight/reading-view';
import {
  buildProseHighlightDebugInfo,
  getProseHighlightLastError,
  recordProseHighlightError,
} from './src/prose-highlight/debug';
import { renderProseHighlightSettings } from './src/prose-highlight/settings-tab';
import { focusExtension } from './src/cm6/focus-mode';
import { gutteredHeadingsExtension } from './src/cm6/guttered-headings';
// TODO(#24): typewriter scroll disabled pending fix
// import { typewriterExtension } from './src/cm6/typewriter-scroll';
import { validateMarkdown, extractFrontmatter } from './src/schemas';
import { generateToc, resolveTocDepth } from './src/document/toc-generator';
import { AutoTocManager } from './src/document/auto-toc';
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

  /**
   * Monotonic token for updatePrintStateFromActiveFile. Two triggers
   * (active-leaf-change and metadataCache 'changed') can race on the same
   * file; a stale read must not overwrite a newer one. Each call captures
   * the token before its await and bails if a newer call has started.
   */
  private printStateSeq = 0;

  /** Temporary 3a probe: does class scoping reach the print DOM? (#28/#29) */
  printProbe = new PrintProbe();

  /** Status bar elements for quick toggles */
  private focusModeStatusEl: HTMLElement | null = null;
  private syntaxDimmingStatusEl: HTMLElement | null = null;

  /**
   * Debounced automatic TOC regeneration. Regenerate-only: touches only
   * notes that already contain a generated TOC block. The host closures
   * capture `this` lazily, so they read live settings at fire time.
   */
  autoTocManager = new AutoTocManager({
    isEnabled: () => this.settings.document.autoToc,
    read: async (path) => {
      const file = this.fileByPath(path);
      return file ? this.app.vault.read(file) : null;
    },
    write: async (path, content) => {
      const file = this.fileByPath(path);
      if (file) await this.app.vault.modify(file, content);
    },
    resolveDepth: (content) =>
      resolveTocDepth(content, this.settings.document.tocDepth),
  });

  /** Resolve a vault path to a TFile, or null when missing / not a file. */
  private fileByPath(path: string): TFile | null {
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? file : null;
  }

  async onload() {
    console.debug('[yaae] onload: starting plugin initialization');
    await this.loadSettings();

    // --- Prose Highlight ---

    // Dynamic CSS for custom word-list colors. POS category colors live in
    // styles.css as layered light/dark CSS variables — Style Settings and
    // theme CSS are the only writers.
    this.styleManager.init(this.settings.proseHighlight);

    // Compile word lists from saved settings
    this.wordListMatcher.compile(
      this.settings.proseHighlight.customWordLists,
    );

    // CM6 ViewPlugin for editor / Live Preview highlighting.
    // Prose highlighting is disabled on mobile pending #32 — it errors / fails
    // to render there. Gate both the editor extension and the Reading View
    // post-processor so the feature is fully off on mobile; desktop is
    // unaffected. The hidden mobileDebugOverride flag lifts the block for
    // on-phone diagnosis: the highlighter now records its errors and degrades
    // instead of dying, so the debug command can capture the root cause.
    // registerEditorExtension still runs so the mutable extensions array
    // stays wired for desktop toggling.
    const highlighterExt = createHighlighterExtension(this);
    if (this.settings.proseHighlight.enabled && !this.proseHighlightBlockedOnMobile()) {
      this.editorExtensions.push(highlighterExt);
    }
    this.registerEditorExtension(this.editorExtensions);

    // Reading View post-processor. Always registered (post-processors can't
    // be added after onload); the mobile gate is checked per-render so the
    // debug override takes effect without a plugin reload.
    const readingViewProcessor = createReadingViewPostProcessor(this);
    this.registerMarkdownPostProcessor((el, ctx) => {
      if (this.proseHighlightBlockedOnMobile()) return;
      try {
        readingViewProcessor(el, ctx);
      } catch (err) {
        // Record for the debug command; the block renders unhighlighted.
        recordProseHighlightError(err, 'reading-view');
      }
    });

    // --- Readability Features ---

    // CSS features: toggle body classes
    this.applyBodyClasses();

    // CM6 features: register via Compartment
    this.registerEditorExtension([
      focusCompartment.of(
        this.settings.focusMode === 'off'
          ? []
          : focusExtension(this.settings.focusMode)
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
        if (this.proseHighlightBlockedOnMobile()) {
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
      id: 'copy-prose-highlight-debug',
      name: 'Copy prose highlighting debug info',
      callback: () => {
        this.copyProseHighlightDebugInfo();
      },
    });

    // Hidden diagnostic switch for #32: lifts the mobile block so the
    // highlighter can be re-tested on a phone. Deliberately command-only —
    // no settings UI — and safe: errors are recorded and degrade to
    // unhighlighted rather than killing the plugin.
    this.addCommand({
      id: 'toggle-prose-highlight-mobile-override',
      name: 'Toggle prose highlighting mobile override (debug)',
      callback: async () => {
        const next = !this.settings.proseHighlight.mobileDebugOverride;
        this.settings.proseHighlight.mobileDebugOverride = next;
        await this.saveSettings();
        console.info('[yaae] Toggled prose highlighting mobile override', { enabled: next });
        this.toggleHighlighting(this.settings.proseHighlight.enabled);
        new Notice(
          next
            ? 'Prose highlighting mobile override ON — highlighting will run on this device.'
            : 'Prose highlighting mobile override OFF — mobile block restored.',
        );
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
    // re-resolve and re-bake the base element on every css-change. The
    // document/chrome elements read the same knobs, so refresh them too.
    this.registerEvent(
      this.app.workspace.on('css-change', () => {
        this.printStyles.refreshVars();
        this.printStyles.refreshDocument();
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

    // Validate on save + auto TOC. One listener for both jobs; each gates on
    // the *current* setting value so toggling in the UI takes effect without
    // requiring a plugin reload. Auto TOC debounces per file and only touches
    // notes that already contain a generated TOC block (regenerate-only).
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (!(file instanceof TFile) || file.extension !== 'md') return;
        this.autoTocManager.notifyModified(file.path);
        if (!this.settings.document.validateOnSave) return;
        this.validateFileQuietly(file);
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
    this.autoTocManager.destroy();
    console.debug('[yaae] onunload: auto TOC manager destroyed, pending regenerations canceled');
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

  /**
   * True when prose highlighting must stay off on this device: mobile,
   * pending the #32 root-cause fix, unless the hidden debug override lifts
   * the block for on-phone diagnosis.
   */
  proseHighlightBlockedOnMobile(): boolean {
    return (
      Platform.isMobile &&
      this.settings.proseHighlight.mobileDebugOverride !== true
    );
  }

  /** Enable or disable the CM6 editor extension. No-op on mobile (#32). */
  toggleHighlighting(enabled: boolean): void {
    const highlighterExt = createHighlighterExtension(this);
    this.editorExtensions.length = 0;
    if (enabled && !this.proseHighlightBlockedOnMobile()) {
      this.editorExtensions.push(highlighterExt);
    }
    this.app.workspace.updateOptions();
  }

  /**
   * One-tap #32 diagnostics: assemble platform + settings + the last
   * recorded highlighter error and put it on the clipboard, so the mobile
   * failure is capturable without remote debugging.
   */
  async copyProseHighlightDebugInfo(): Promise<void> {
    const info = buildProseHighlightDebugInfo({
      pluginVersion: this.manifest.version,
      isMobile: Platform.isMobile,
      mobileDebugOverride: this.settings.proseHighlight.mobileDebugOverride === true,
      highlightingEnabled: this.settings.proseHighlight.enabled,
      readingViewEnabled: this.settings.proseHighlight.readingViewEnabled,
      userAgent: navigator.userAgent,
    });
    try {
      await navigator.clipboard.writeText(info);
      const error = getProseHighlightLastError();
      console.info('[yaae] Successfully copied prose highlighting debug info to clipboard', {
        hasError: error !== null,
        errorPhase: error?.phase,
      });
      new Notice(
        error
          ? `Debug info copied — last error: ${error.message}`
          : 'Debug info copied — no highlighter error recorded this session.',
        8000,
      );
    } catch (err) {
      console.error('[yaae] Failed to copy debug info to clipboard. Dumping to console instead:', err);
      console.info(info);
      new Notice('Clipboard unavailable — debug info dumped to the developer console.', 8000);
    }
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
              this.settings.focusMode === 'off'
                ? []
                : focusExtension(this.settings.focusMode)
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

    // Per-file frontmatter override wins over the settings default
    const depth = resolveTocDepth(content, this.settings.document.tocDepth);

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
    const seq = ++this.printStateSeq;
    const startFile = this.app.workspace.getActiveFile();
    if (!startFile) {
      // No active file at all — fall back to defaults so the pipeline
      // reflects settings.
      this.activeDoc = null;
      this.printStyles.refreshDocument();
      return;
    }
    if (startFile.extension !== 'md') {
      // Active leaf is non-markdown (e.g., embedded PDF, canvas). Leave the
      // existing print state alone so the last markdown file's
      // classification is preserved for export.
      return;
    }

    const content = await this.app.vault.read(startFile);

    // Race guard: bail if the active file changed during the read, OR if a
    // newer invocation started while we were reading (active-leaf-change and
    // metadataCache 'changed' can both fire for the same file — a stale read
    // must not clobber the newer one).
    if (
      seq !== this.printStateSeq ||
      this.app.workspace.getActiveFile() !== startFile
    ) {
      console.debug('[yaae] updatePrintStateFromActiveFile: superseded mid-read, aborting');
      return;
    }

    this.activeDoc = {
      raw: extractFrontmatter(content),
      validated: validateMarkdown(content).data,
    };
    this.printStyles.refreshDocument();
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

    const githubSetting = new Setting(containerEl).setName('GitHub');
    const githubLink = document.createElement('a');
    githubLink.textContent = 'Open';
    githubLink.href = 'https://github.com/cameronsjo/yaae';
    githubLink.target = '_blank';
    githubLink.rel = 'noopener noreferrer';
    githubLink.classList.add('mod-cta');
    githubSetting.controlEl.append(githubLink);

    new Setting(containerEl)
      .setName('Description')
      .setDesc(this.plugin.manifest.description);
  }
}
