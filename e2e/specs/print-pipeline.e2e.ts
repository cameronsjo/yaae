/**
 * Print pipeline E2E (#28/#29).
 *
 * The wdio harness ships Obsidian on Chrome 120, so this suite exercises the
 * BELOW-131 path end to end: fixed chrome strategy selected, body classes
 * synced on note switch, frontmatter edits refreshing without a leaf change,
 * and the base element carrying baked (var-free) defaults.
 */

const PLUGIN_ID = "yaae";

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

async function styleContent(id: string): Promise<string> {
  return browser.execute(
    (elId) => document.getElementById(elId)?.textContent ?? "",
    id,
  );
}

async function hasBodyClass(cls: string): Promise<boolean> {
  return browser.execute((c) => document.body.classList.contains(c), cls);
}

describe("print pipeline", () => {
  before(async () => {
    await browser.executeObsidian(async ({ app }) => {
      await (app as any).plugins.enablePlugin("yaae");
    });
    await browser.pause(500);
  });

  it("creates the three pipeline style elements", async () => {
    for (const id of [
      "yaae-print-base",
      "yaae-print-document",
      "yaae-print-chrome",
    ]) {
      const exists = await browser.execute(
        (elId) => document.getElementById(elId) !== null,
        id,
      );
      expect(exists).toBe(true);
    }
  });

  it("base element carries baked defaults — no unresolved yaae knobs", async () => {
    const css = await styleContent("yaae-print-base");
    expect(css).toContain("@media print");
    expect(css).not.toContain("var(--yaae-print-");
  });

  it("selects the fixed chrome strategy on this Chrome (<131)", async () => {
    const chromeMajor = await browser.execute(() =>
      parseInt(navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] ?? "0", 10),
    );
    // The harness pins Chrome 120; guard in case the installer moves.
    if (chromeMajor >= 131) return;

    await createAndOpenNote(
      "print-fixed.md",
      "---\ntitle: Fixed\ncreated: 2024-01-01\nclassification: confidential\n---\n\n# H\n",
    );
    const css = await styleContent("yaae-print-chrome");
    expect(css).toContain("position: fixed");
    expect(css).not.toContain("counter(page)");
    expect(css).not.toContain("@top-center");
  });

  it("syncs pdf-* body classes on note switch and replaces them", async () => {
    await createAndOpenNote(
      "print-dark.md",
      "---\ntitle: Dark\ncreated: 2024-01-01\nexport:\n  pdf:\n    theme: dark\n---\n\n# H\n",
    );
    expect(await hasBodyClass("pdf-theme-dark")).toBe(true);

    await createAndOpenNote(
      "print-light.md",
      "---\ntitle: Light\ncreated: 2024-01-01\nexport:\n  pdf:\n    theme: light\n---\n\n# H\n",
    );
    expect(await hasBodyClass("pdf-theme-dark")).toBe(false);
  });

  it("frontmatter edit WITHOUT a leaf change refreshes the pipeline", async () => {
    await createAndOpenNote(
      "print-edit.md",
      "---\ntitle: Edit\ncreated: 2024-01-01\n---\n\n# H\n",
    );
    expect(await hasBodyClass("pdf-signature-block")).toBe(false);

    // Modify frontmatter in place — same leaf stays active.
    await browser.executeObsidian(async ({ app }) => {
      const file = app.vault.getAbstractFileByPath("print-edit.md");
      if (file) {
        await app.vault.modify(
          file as any,
          "---\ntitle: Edit\ncreated: 2024-01-01\nexport:\n  pdf:\n    signatureBlock: true\n---\n\n# H\n",
        );
      }
    });
    // metadataCache 'changed' fires async — poll briefly.
    await browser.waitUntil(async () => hasBodyClass("pdf-signature-block"), {
      timeout: 5000,
      timeoutMsg:
        "signature block state never refreshed after frontmatter edit",
    });
    const docCss = await styleContent("yaae-print-document");
    expect(docCss).toContain("Prepared by:");
  });

  it("state-bakes the active document rules (correctness without classes)", async () => {
    await createAndOpenNote(
      "print-plain-links.md",
      "---\ntitle: Links\ncreated: 2024-01-01\nexport:\n  pdf:\n    links: plain\n---\n\n[x](https://example.com)\n",
    );
    await browser.waitUntil(
      async () =>
        (await styleContent("yaae-print-document")).includes(
          ".print .markdown-preview-view a",
        ),
      { timeout: 5000, timeoutMsg: "links-mode rules never state-baked" },
    );
  });
});
