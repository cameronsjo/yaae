/**
 * Prose-highlighting failure diagnostics (#32).
 *
 * The mobile failure is an uncaptured runtime error: CM6 ejects a ViewPlugin
 * whose update() throws, which matches the reported "errors / won't load"
 * symptom, and mobile has no dev console within reach. The highlighter now
 * records its last error here (and degrades to unhighlighted instead of
 * being ejected); the "Copy prose highlighting debug info" command makes the
 * record capturable from a phone in one tap.
 */

export type ProseHighlightErrorPhase =
  | 'decoration-build'
  | 'update'
  | 'reading-view';

export interface ProseHighlightErrorRecord {
  message: string;
  stack?: string;
  phase: ProseHighlightErrorPhase;
  /** ISO timestamp of the most recent occurrence. */
  at: string;
  /** Occurrences of this same message+phase since it was first recorded. */
  count: number;
}

let lastError: ProseHighlightErrorRecord | null = null;

/**
 * Record a highlighter failure. Repeats of the same message+phase bump the
 * counter instead of re-logging — update() runs per keystroke, and a
 * persistent fault must not flood the console.
 */
export function recordProseHighlightError(
  err: unknown,
  phase: ProseHighlightErrorPhase,
): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  const at = new Date().toISOString();

  if (lastError && lastError.message === message && lastError.phase === phase) {
    lastError.count++;
    lastError.at = at;
    return;
  }

  lastError = { message, stack, phase, at, count: 1 };
  console.error(
    `[yaae] Prose highlighting failed (${phase}) — degraded to unhighlighted. ` +
      'Run "Copy prose highlighting debug info" to capture details.',
    err,
  );
}

export function getProseHighlightLastError(): ProseHighlightErrorRecord | null {
  return lastError;
}

/** Test seam — clears the module-level record. */
export function clearProseHighlightLastError(): void {
  lastError = null;
}

export interface ProseHighlightDebugContext {
  pluginVersion: string;
  isMobile: boolean;
  mobileDebugOverride: boolean;
  highlightingEnabled: boolean;
  readingViewEnabled: boolean;
  userAgent: string;
}

/** Render the one-tap debug report the copy command puts on the clipboard. */
export function buildProseHighlightDebugInfo(
  ctx: ProseHighlightDebugContext,
): string {
  const error = getProseHighlightLastError();
  const lines = [
    '## YAAE prose highlighting debug info',
    '',
    `- Plugin version: ${ctx.pluginVersion}`,
    `- Mobile: ${ctx.isMobile}`,
    `- Mobile debug override: ${ctx.mobileDebugOverride}`,
    `- Highlighting enabled: ${ctx.highlightingEnabled}`,
    `- Reading view enabled: ${ctx.readingViewEnabled}`,
    `- User agent: ${ctx.userAgent}`,
    '',
  ];

  if (error) {
    lines.push(
      '### Last error',
      '',
      `- Phase: ${error.phase}`,
      `- Message: ${error.message}`,
      `- Last seen: ${error.at}`,
      `- Occurrences: ${error.count}`,
      '',
      '```',
      error.stack ?? '(no stack available)',
      '```',
    );
  } else {
    lines.push('### Last error', '', 'none recorded this session');
  }

  return lines.join('\n');
}
