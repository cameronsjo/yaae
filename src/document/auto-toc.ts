/**
 * Debounced automatic TOC regeneration.
 *
 * Regenerate-only semantics: a note opts in by inserting a TOC once via the
 * generate command; auto mode keeps that block fresh on subsequent edits.
 * Notes without a TOC block are never touched.
 *
 * The manager is deliberately decoupled from Obsidian types — the plugin
 * supplies vault access through {@link AutoTocHost} so the debounce, gate,
 * and loop-guard logic is testable with plain fakes and fake timers.
 */

import { generateToc, hasToc } from "./toc-generator";

export const AUTO_TOC_DEBOUNCE_MS = 2000;

export interface AutoTocHost {
  /** Current value of the autoToc setting — read at both schedule and fire time. */
  isEnabled(): boolean;
  /** Read the file's current content, or null if it no longer exists. */
  read(path: string): Promise<string | null>;
  /** Overwrite the file's content. */
  write(path: string, content: string): Promise<void>;
  /** Resolve TOC depth for this content (frontmatter override or settings default). */
  resolveDepth(content: string): number;
}

export class AutoTocManager {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private host: AutoTocHost,
    private debounceMs: number = AUTO_TOC_DEBOUNCE_MS,
  ) {}

  /** Files with a regeneration pass pending. */
  get pendingCount(): number {
    return this.timers.size;
  }

  /**
   * Called from the vault 'modify' handler. Debounces per file (trailing):
   * a burst of saves collapses into one regeneration pass. Our own write
   * fires 'modify' too — that pass finds the content already fresh and
   * skips the write, terminating the modify→modify loop.
   */
  notifyModified(path: string): void {
    if (!this.host.isEnabled()) return;
    const pending = this.timers.get(path);
    if (pending !== undefined) clearTimeout(pending);
    console.debug(
      `[yaae] Preparing to regenerate TOC. File: ${path}, Debounce: ${this.debounceMs}ms`,
    );
    this.timers.set(
      path,
      setTimeout(() => {
        this.timers.delete(path);
        this.regenerate(path).catch((err) => {
          console.warn(
            `[yaae] Auto TOC regeneration failed. File: ${path}`,
            err,
          );
        });
      }, this.debounceMs),
    );
  }

  private async regenerate(path: string): Promise<void> {
    // Re-check at fire time — the toggle may have flipped during the debounce.
    if (!this.host.isEnabled()) {
      console.debug(
        `[yaae] Skipping auto TOC. File: ${path}, Reason: setting disabled at fire time`,
      );
      return;
    }
    const content = await this.host.read(path);
    if (content === null) {
      console.debug(
        `[yaae] Skipping auto TOC. File: ${path}, Reason: file deleted or renamed`,
      );
      return; // deleted or renamed since scheduling
    }
    if (!hasToc(content)) {
      console.debug(
        `[yaae] Skipping auto TOC. File: ${path}, Reason: no existing TOC block (regenerate-only mode)`,
      );
      return; // regenerate-only: no TOC block, not opted in
    }
    const depth = this.host.resolveDepth(content);
    const { content: updated, entryCount } = generateToc(content, depth);
    if (updated === content) {
      console.debug(
        `[yaae] Skipping auto TOC write. File: ${path}, Reason: content already fresh (loop terminator)`,
      );
      return; // already fresh — loop terminator
    }
    // Race guard: a newer edit arrived while we were reading. Its own pass
    // will regenerate against the newer content; writing ours now could
    // clobber that edit with the stale read.
    if (this.timers.has(path)) {
      console.debug(
        `[yaae] Skipping auto TOC write. File: ${path}, Reason: newer edit arrived during read (race guard)`,
      );
      return;
    }
    await this.host.write(path, updated);
    console.info(
      `[yaae] Successfully regenerated TOC. File: ${path}, Entries: ${entryCount}, Depth: ${depth}`,
    );
  }

  /** Cancel all pending regenerations (plugin unload). */
  destroy(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
