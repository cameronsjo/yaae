import { obsidianPage } from "wdio-obsidian-service";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** Prose-color acceptance in wdio's copied vault and temporary Electron profile. */
describe("prose highlighting in a real vault", () => {
  const filename = "prose-acceptance.md";
  const content = "He ran to his house.\n\n```text\nHe ran to his house.\n```\n";

  before(async () => {
    const vault = obsidianPage.getVaultPath();
    const relative = vault ? path.relative(realpathSync(tmpdir()), realpathSync(vault)) : "..";
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || !path.basename(vault).startsWith("vault-")) {
      throw new Error(`Refusing prose acceptance outside a throwaway wdio vault: ${vault}`);
    }
    await browser.executeObsidian(async ({ app }, { filename, content }) => {
      const plugin = (app as any).plugins.plugins.yaae;
      plugin.settings.proseHighlight.enabled = true;
      plugin.settings.proseHighlight.readingViewEnabled = true;
      plugin.toggleHighlighting(true);
      const file = await app.vault.create(filename, content);
      await app.workspace.getLeaf(false).openFile(file);
      const leaf = app.workspace.activeLeaf!;
      await leaf.setViewState({ ...leaf.getViewState(), state: {
        ...leaf.getViewState().state, mode: "source", source: false,
      } });
    }, { filename, content });
  });

  async function visibleTags(selector: string) {
    return browser.execute((selector) =>
      [...document.querySelectorAll(`${selector} [class*='yaae-pos-']`)].map((el) => ({
        text: el.textContent,
        classes: el.className,
        color: getComputedStyle(el).color,
      })), selector);
  }

  it("colors prose verbs/nouns and excludes identical fenced text in the editor", async () => {
    await browser.waitUntil(async () => (await visibleTags(".cm-content")).length >= 2,
      { timeout: 10000, timeoutMsg: "editor prose colors did not render" });
    const tags = await visibleTags(".cm-content");
    expect(tags.filter((t) => t.classes.includes("yaae-pos-noun")).map((t) => t.text)).toEqual(["house"]);
    expect(tags.filter((t) => t.classes.includes("yaae-pos-verb")).map((t) => t.text)).toEqual(["ran"]);
    expect(new Set(tags.map((t) => t.color)).size).toBeGreaterThan(1);
    await browser.saveScreenshot(path.join(tmpdir(), "yaae44-editor.png"));
  });

  it("renders the same categories in reading view without coloring code", async () => {
    await browser.executeObsidian(async ({ app }) => {
      const leaf = app.workspace.activeLeaf!;
      await leaf.setViewState({ ...leaf.getViewState(), state: {
        ...leaf.getViewState().state, mode: "preview",
      } });
      (leaf.view as any).previewMode?.rerender?.(true);
    });
    await browser.waitUntil(async () => (await visibleTags(".markdown-preview-view")).length >= 2,
      { timeout: 10000, timeoutMsg: "reading-view prose colors did not render" });
    const tags = await visibleTags(".markdown-preview-view");
    expect(tags.filter((t) => t.classes.includes("yaae-pos-noun")).map((t) => t.text)).toEqual(["house"]);
    expect(tags.filter((t) => t.classes.includes("yaae-pos-verb")).map((t) => t.text)).toEqual(["ran"]);
    expect(await browser.execute(() => document.querySelectorAll("pre [class*='yaae-pos-']").length)).toBe(0);
    await browser.saveScreenshot(path.join(tmpdir(), "yaae44-reading-view.png"));
  });
});
