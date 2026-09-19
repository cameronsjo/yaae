/**
 * YAAE E2E Smoke Tests
 *
 * Verify every README-claimed feature works inside a real Obsidian instance.
 * Uses wdio-obsidian-service to launch Obsidian with the plugin installed.
 */

const PLUGIN_ID = "yaae";

// --- Helpers ---

async function createAndOpenNote(
  filename: string,
  content: string,
): Promise<void> {
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

/**
 * Force `gutteredHeadings` to a known value and apply it to open editors.
 *
 * Needed because an earlier spec runs the toggle command, so this describe
 * cannot assume the shipped default still holds. Tests that inherit state from
 * whichever spec ran before them fail for reasons that have nothing to do with
 * what they name (#53).
 */
async function setGutteredHeadings(enabled: boolean): Promise<void> {
  await browser.executeObsidian(
    async ({ app }, { id, enabled }) => {
      const plugin = (app as any).plugins.plugins[id];
      if (!plugin) throw new Error(`plugin ${id} not loaded`);
      plugin.settings.gutteredHeadings = enabled;
      plugin.reconfigureGutteredHeadings();
      await plugin.saveSettings();
    },
    { id: PLUGIN_ID, enabled },
  );
  await browser.pause(200);
}

/**
 * Toggle the classification banner setting and persist it, so the reading-view
 * post-processor picks it up. The processor reads settings at render time, so
 * no reload is needed.
 */
async function setBannerSetting(enabled: boolean): Promise<void> {
  await browser.executeObsidian(
    async ({ app }, { id, enabled }) => {
      const plugin = (app as any).plugins.plugins[id];
      if (!plugin) throw new Error(`plugin ${id} not loaded`);
      plugin.settings.document.showClassificationBanner = enabled;
      await plugin.saveSettings();
    },
    { id: PLUGIN_ID, enabled },
  );
  await browser.pause(200);
}

// --- Tests ---

describe("YAAE plugin smoke tests", () => {
  describe("plugin lifecycle", () => {
    it("plugin is loaded and enabled", async () => {
      const isLoaded = await browser.executeObsidian(({ app }) => {
        const plugins = (app as any).plugins;
        return plugins?.enabledPlugins?.has("yaae") ?? false;
      });
      expect(isLoaded).toBe(true);
    });
  });

  describe("commands", () => {
    const commands = [
      "toggle-prose-highlighting",
      "toggle-syntax-dimming",
      "toggle-guttered-headings",
      "cycle-focus-mode",
    ];

    for (const cmd of commands) {
      it(`command "${cmd}" executes without error`, async () => {
        await executeCommand(cmd);
      });
    }

    it("validate frontmatter executes on a markdown file", async () => {
      await createAndOpenNote(
        "test-validate.md",
        "---\ntitle: Test\nclassification: internal\n---\n# Hello\n",
      );
      await executeCommand("yaae-validate");
    });
  });

  describe("CM6 gutter — guttered headings", () => {
    before(async () => {
      await createAndOpenNote(
        "heading-test.md",
        "---\ntitle: Heading Test\n---\n\n# Heading 1\n\nBody text.\n\n## Heading 2\n\nMore text.\n\n### Heading 3\n",
      );
      // Start from a known ON state. An earlier spec runs the toggle command,
      // so the shipped default cannot be assumed here.
      await setGutteredHeadings(true);
    });

    async function gutterCount(): Promise<number> {
      return browser.execute(() => {
        return document.querySelectorAll(".cm-gutter.yaae-heading-gutter")
          .length;
      });
    }

    async function markerCount(): Promise<number> {
      return browser.execute(() => {
        return document.querySelectorAll(".yaae-heading-gutter-marker").length;
      });
    }

    // Wait for the count to reach a value rather than pausing a fixed 200 ms.
    // The toggle dispatches a CM6 compartment reconfigure, and the DOM catches
    // up a beat later; on a loaded machine 200 ms was not enough, which is why
    // this spec failed on main (#53). The toggle itself was never broken.
    async function waitForGutterCount(want: number): Promise<void> {
      await browser.waitUntil(async () => (await gutterCount()) === want, {
        timeout: 5000,
        interval: 100,
        timeoutMsg: `gutter count never reached ${want} (last: ${await gutterCount()})`,
      });
    }

    it("toggle adds and removes the heading gutter element", async () => {
      const before = await gutterCount();
      // The gutter ships on by default, so there is something to remove.
      expect(before).toBeGreaterThan(0);

      await executeCommand("toggle-guttered-headings");
      await waitForGutterCount(0);

      await executeCommand("toggle-guttered-headings");
      await waitForGutterCount(before);
    });

    // A Compartment's `.of()` content is captured at plugin load, and
    // reconfigure only reaches editors that already exist — so before #53 a
    // note opened after the toggle started from the load-time value and showed
    // the gutter again despite the setting being off.
    it("keeps the gutter off for a note opened after toggling off", async () => {
      await setGutteredHeadings(true);
      await executeCommand("toggle-guttered-headings");
      await waitForGutterCount(0);

      await createAndOpenNote(
        "heading-test-2.md",
        "---\ntitle: Second\n---\n\n# Another Heading\n\nBody.\n\n## And Another\n",
      );
      await waitForGutterCount(0);

      await setGutteredHeadings(true);
    });

    it("renders heading markers in the gutter for #, ##, ### lines", async () => {
      // Ensure the gutter is on
      const enabled = (await gutterCount()) > 0;
      if (!enabled) {
        await executeCommand("toggle-guttered-headings");
        await browser.pause(200);
      }

      // Three headings in the test note → three markers
      expect(await markerCount()).toBeGreaterThanOrEqual(3);

      // Restore initial state if we toggled
      if (!enabled) {
        await executeCommand("toggle-guttered-headings");
        await browser.pause(200);
      }
    });
  });

  describe("body classes — syntax dimming", () => {
    it("toggle flips the body class on and off", async () => {
      const before = await hasBodyClass("yaae-syntax-dimming");

      await executeCommand("toggle-syntax-dimming");
      expect(await hasBodyClass("yaae-syntax-dimming")).toBe(!before);

      await executeCommand("toggle-syntax-dimming");
      expect(await hasBodyClass("yaae-syntax-dimming")).toBe(before);
    });
  });

  describe("focus mode", () => {
    before(async () => {
      await createAndOpenNote(
        "focus-test.md",
        "---\ntitle: Focus Test\n---\n\nFirst sentence. Second sentence. Third sentence.\n\nAnother paragraph here. With more sentences.\n",
      );
    });

    it("cycle command executes three times without error", async () => {
      // Cycle: off → sentence → paragraph → off
      // Focus mode dimming requires cursor focus in the editor,
      // so we verify the commands execute without throwing
      await executeCommand("cycle-focus-mode"); // → sentence
      await executeCommand("cycle-focus-mode"); // → paragraph
      await executeCommand("cycle-focus-mode"); // → off
    });
  });

  describe("classification banner", () => {
    // showClassificationBanner ships OFF (src/document/settings.ts). This spec
    // asserted the banner rendered without ever opting in, so it failed on main
    // for the whole time it existed (#53) — the banner was behaving correctly.
    before(async () => {
      await setBannerSetting(true);
    });

    after(async () => {
      await setBannerSetting(false);
    });

    it("shows banner in reading view when the setting is opted into", async () => {
      await createAndOpenNote(
        "classified.md",
        "---\ntitle: Secret Doc\nclassification: confidential\n---\n\n# Confidential Content\n\nThis is classified.\n",
      );

      // Switch to Reading View
      await browser.executeObsidian(({ app }) => {
        const leaf = app.workspace.activeLeaf;
        if (leaf) {
          const state = leaf.getViewState();
          state.state = { ...state.state, mode: "preview" };
          leaf.setViewState(state);
        }
      });
      // Wait for the element rather than pausing a fixed 1000 ms: the view
      // switch and the post-processor render are both async.
      await browser.waitUntil(
        async () =>
          browser.execute(
            () =>
              document.querySelectorAll(".yaae-classification-banner").length >
              0,
          ),
        {
          timeout: 5000,
          interval: 100,
          timeoutMsg: "classification banner never rendered in reading view",
        },
      );
    });
  });

  describe("TOC generation", () => {
    it("inserts table of contents into document", async () => {
      const original =
        "---\ntitle: TOC Test\n---\n\n## Table of Contents\n\n---\n\n## Section A\n\n### Sub A1\n\n## Section B\n";
      await createAndOpenNote("toc-test.md", original);

      // Use the Obsidian API directly to generate TOC (bypasses editorCheckCallback)
      const content = await browser.executeObsidian(async ({ app }) => {
        // Trigger via the plugin's internal method
        const plugin = (app as any).plugins?.plugins?.yaae;
        if (plugin?.generateTocForCurrentFile) {
          await plugin.generateTocForCurrentFile();
        }
        await new Promise((r) => setTimeout(r, 500));
        const file = app.vault.getAbstractFileByPath("toc-test.md");
        if (file) return app.vault.read(file as any);
        return "";
      });

      expect(content).toContain("Section A");
      expect(content).toContain("Sub A1");
      expect(content).toContain("Section B");
      // TOC should have markdown links
      expect(content).toMatch(/\[.*\]\(#.*\)/);
    });
  });
});
