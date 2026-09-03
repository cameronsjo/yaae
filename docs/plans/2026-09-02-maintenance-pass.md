# YAAE Maintenance Pass

## Goal

Resolve the existing YAAE maintenance backlog: restore a truthful TypeScript validation check, repair or deliberately retire broken readability behavior, verify and reconcile stale GitHub issues, and update the theming contract documentation.

## Scope

This pass covers the open GitHub issues discovered on 2026-09-02 (#23, #24, #26, #27, #28, #33, and #38), plus the seven current `pnpm exec tsc --noEmit` errors.

## Requirements

- `pnpm exec tsc --noEmit` MUST exit successfully and be included in an automated project quality check.
- Each resolved GitHub issue MUST have behavior-level tests or documented runtime verification appropriate to its surface.
- Issues whose requested behavior already landed MUST be verified against source and closed with an explanatory comment rather than reimplemented.
- The typewriter-scroll feature MUST either work in current Obsidian/CodeMirror runtime conditions or be removed with #24 closed as declined; it MUST NOT remain exposed as a non-working setting or command.
- PDF TOC links MUST be investigated against Obsidian export constraints; an unsupported platform behavior MUST be documented and the issue dispositioned rather than faked.
- User-visible documentation MUST reflect the actual theming precedence contract.

## Chosen Approach

Work from integrity outward: first make type checking authoritative, then address contained readability bugs, then reconcile PDF and documentation issues using source and runtime evidence. This avoids treating a successful esbuild bundle as proof that the plugin type-checks.

## Alternatives Declined

- Fix only the reported runtime bugs: declined because the current build conceals TypeScript regressions.
- Reopen mobile prose highlighting (#32): declined because it is closed as an intentional scope reduction and has no captured mobile runtime error to diagnose.
- Close stale issues based only on commit messages: declined because source behavior and tests must confirm the issue resolution.

## Checklist

- [x] Establish `tsc --noEmit` as a passing, automated validation check; repair configuration, stale symbols, API typing, and module declarations.
- [x] Fix focus mode's blank-line dimming (#23) with behavior tests.
- [x] Investigate typewriter scroll (#24); repair and test it, or remove its public surface and close the issue with rationale.
- [x] Verify responsive mobile gutter behavior (#33) and add coverage; close or implement the remaining gap.
- [x] Verify runtime PDF-style injection against #28 and reconcile the issue state.
- [x] Investigate PDF TOC navigation (#26); implement a supported fix or document and close an Obsidian export limitation.
- [x] Add advanced watermark preset configuration (#27) with validation, settings UI, and tests.
- [x] Correct and version the theming precedence contract (#38).
- [x] Run fresh typecheck, tests, build, and relevant E2E/manual checks; reconcile every issue and update this plan with any deviations.

## Dispatch Assessment

After the typecheck baseline is repaired, #23, #27, #33, and #38 have likely disjoint implementation surfaces. They MAY be dispatched in parallel under the arrange mode once their exact files and tests are confirmed; #24, #26, and #28 require investigation or cross-cutting lifecycle analysis first and remain serial until their conclusions are known.
