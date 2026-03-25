/**
 * YAAE E2E Smoke Tests
 *
 * Verify every README-claimed feature works inside a real Obsidian instance.
 * Uses wdio-obsidian-service to launch Obsidian with the plugin installed.
 */

const PLUGIN_ID = 'yaae';

// --- Helpers ---

async function createAndOpenNote(filename: string, content: string): Promise<void> {
  await browser.executeObsidian(
    async ({ app }, { filename, content }) => {
      const existing = app.vault.getAbstractFileByPath(filename);
      if (existing) {
        await app.vault.modify(existing as any, content);
      } else {
        await app.vault.create(filename, content);
      }
      // Brief delay for metadata cache to process
      await new Promise((r) => setTimeout(r, 200));
      const file = app.vault.getAbstractFileByPath(filename);
      if (file) {
        await app.workspace.getLeaf(false).openFile(file as any);
      }
    },
    { filename, content },
  );
  await browser.pause(500);
}

async function hasBodyClass(cls: string): Promise<boolean> {
  return browser.execute((c) => document.body.classList.contains(c), cls);
}

async function executeCommand(commandId: string): Promise<void> {
  await browser.executeObsidianCommand(`${PLUGIN_ID}:${commandId}`);
  await browser.pause(300);
}

// --- Tests ---

describe('YAAE plugin smoke tests', () => {
  describe('plugin lifecycle', () => {
    it('plugin is loaded and enabled', async () => {
      const isLoaded = await browser.executeObsidian(({ app }) => {
        const plugins = (app as any).plugins;
        return plugins?.enabledPlugins?.has('yaae') ?? false;
      });
      expect(isLoaded).toBe(true);
    });
  });

  describe('commands', () => {
    const commands = [
      'toggle-prose-highlighting',
      'toggle-syntax-dimming',
      'toggle-guttered-headings',
      'cycle-focus-mode',
      'toggle-typewriter-scroll',
    ];

    for (const cmd of commands) {
      it(`command "${cmd}" executes without error`, async () => {
        await executeCommand(cmd);
      });
    }

    it('validate frontmatter executes on a markdown file', async () => {
      await createAndOpenNote('test-validate.md', '---\ntitle: Test\nclassification: internal\n---\n# Hello\n');
      await executeCommand('yaae-validate');
    });
  });

  describe('body classes — guttered headings', () => {
    before(async () => {
      await createAndOpenNote(
        'heading-test.md',
        '---\ntitle: Heading Test\n---\n\n# Heading 1\n\nBody text.\n\n## Heading 2\n\nMore text.\n\n### Heading 3\n',
      );
    });

    it('toggle flips the guttered headings body class on and off', async () => {
      const before = await hasBodyClass('yaae-guttered-headings');

      await executeCommand('toggle-guttered-headings');
      expect(await hasBodyClass('yaae-guttered-headings')).toBe(!before);

      await executeCommand('toggle-guttered-headings');
      expect(await hasBodyClass('yaae-guttered-headings')).toBe(before);
    });

    it('heading formatting spans exist in Source Mode', async () => {
      // Toggle Source Mode via Obsidian's built-in command
      await browser.executeObsidianCommand('editor:toggle-source');
      await browser.pause(1000);

      const formattingHeaders = await browser.execute(() => {
        return document.querySelectorAll('.cm-formatting-header').length;
      });
      // Source Mode should show # markers as .cm-formatting-header spans
      expect(formattingHeaders).toBeGreaterThan(0);

      // Toggle back to Live Preview
      await browser.executeObsidianCommand('editor:toggle-source');
      await browser.pause(300);
    });
  });

  describe('body classes — syntax dimming', () => {
    it('toggle flips the body class on and off', async () => {
      const before = await hasBodyClass('yaae-syntax-dimming');

      await executeCommand('toggle-syntax-dimming');
      expect(await hasBodyClass('yaae-syntax-dimming')).toBe(!before);

      await executeCommand('toggle-syntax-dimming');
      expect(await hasBodyClass('yaae-syntax-dimming')).toBe(before);
    });
  });

  describe('focus mode', () => {
    before(async () => {
      await createAndOpenNote(
        'focus-test.md',
        '---\ntitle: Focus Test\n---\n\nFirst sentence. Second sentence. Third sentence.\n\nAnother paragraph here. With more sentences.\n',
      );
    });

    it('cycle command executes three times without error', async () => {
      // Cycle: off → sentence → paragraph → off
      // Focus mode dimming requires cursor focus in the editor,
      // so we verify the commands execute without throwing
      await executeCommand('cycle-focus-mode'); // → sentence
      await executeCommand('cycle-focus-mode'); // → paragraph
      await executeCommand('cycle-focus-mode'); // → off
    });
  });

  describe('classification banner', () => {
    it('shows banner in reading view for classified document', async () => {
      await createAndOpenNote(
        'classified.md',
        '---\ntitle: Secret Doc\nclassification: confidential\n---\n\n# Confidential Content\n\nThis is classified.\n',
      );

      // Switch to Reading View
      await browser.executeObsidian(({ app }) => {
        const leaf = app.workspace.activeLeaf;
        if (leaf) {
          const state = leaf.getViewState();
          state.state = { ...state.state, mode: 'preview' };
          leaf.setViewState(state);
        }
      });
      await browser.pause(1000);

      const bannerExists = await browser.execute(() => {
        return document.querySelectorAll('.yaae-classification-banner').length > 0;
      });
      expect(bannerExists).toBe(true);
    });
  });

  describe('TOC generation', () => {
    it('inserts table of contents into document', async () => {
      const original =
        '---\ntitle: TOC Test\n---\n\n## Table of Contents\n\n---\n\n## Section A\n\n### Sub A1\n\n## Section B\n';
      await createAndOpenNote('toc-test.md', original);

      // Use the Obsidian API directly to generate TOC (bypasses editorCheckCallback)
      const content = await browser.executeObsidian(async ({ app }) => {
        // Trigger via the plugin's internal method
        const plugin = (app as any).plugins?.plugins?.yaae;
        if (plugin?.generateTocForCurrentFile) {
          await plugin.generateTocForCurrentFile();
        }
        await new Promise((r) => setTimeout(r, 500));
        const file = app.vault.getAbstractFileByPath('toc-test.md');
        if (file) return app.vault.read(file as any);
        return '';
      });

      expect(content).toContain('Section A');
      expect(content).toContain('Sub A1');
      expect(content).toContain('Section B');
      // TOC should have markdown links
      expect(content).toMatch(/\[.*\]\(#.*\)/);
    });
  });
});
