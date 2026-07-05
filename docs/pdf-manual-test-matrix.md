# PDF Pipeline — Manual Test Matrix

Companion to the runtime-injection overhaul (#28/#29). The unit suite covers
generation; the wdio E2E covers the Chrome 120 fallback path. This matrix is
what a human verifies with real exports before a release.

The acceptance test for the original complaint is **bold**.

## Machines

| Machine | Chrome | Strategy under test |
|---|---|---|
| Personal Mac (M5) | < 131 (check Settings → Page numbers desc for detected version) | position:fixed chrome, page-number degradation notice |
| Work Mac | 132 | @page margin boxes |

## Matrix

| # | Scenario | Steps | Expect |
|---|---|---|---|
| 1 | **Style Settings knob → PDF** | Change e.g. "Code background" under PDF Print Styles; re-export a note with a code block | **The knob value appears in the exported PDF** (no plugin reload needed) |
| 2 | Classification banner | Note with `classification: confidential`; export on both Macs | ≥131: banner in the top margin box. <131: fixed banner at the page top, repeating on every page |
| 3 | Page numbers | Enable Page numbers; export | ≥131: "Page X of Y" bottom-right. <131: absent, and the settings tab explains why with the detected Chrome version |
| 4 | Headers/footers | Set default header/footer text; export | Text renders per strategy; chrome text color/size follows the Style Settings knobs |
| 5 | Per-doc theme | `export.pdf.theme: dark` on one note only | That note exports dark; the next (unset) note exports light per settings |
| 6 | Frontmatter edit, no leaf change | With a note open, add `export.pdf.signatureBlock: true`; export without switching notes | Signature block present (stale-chrome bug fixed) |
| 7 | Watermark | `status: draft` (explicit) with default draft watermark set; export | Watermark tiles; explicit `export.pdf.watermark` beats the draft default |
| 8 | Signature block collision | signatureBlock + footer-right + bannerPosition both | Bottom banner and (on <131) footer-right suppressed; signature block renders |
| 9 | No frontmatter classes | A note whose frontmatter has NO cssclasses | Everything above still renders (state-baked path; classes are a courtesy) |
| 10 | Legacy cleanup | Run "Clean PDF CSS classes from frontmatter" on a note with old `cssclasses: [pdf-...]` | pdf-* entries removed, user classes intact |
| 11 | Dark/auto surface | `theme: auto` note exported with OS dark mode on | Dark surface + banner colors (nested prefers-color-scheme override) |
| 12 | Probe (3a gate — once) | Run "Toggle print probe (debug)", export, run "Copy print probe report" on BOTH Macs | H1 verdict: underline only → class scoping dead; red → body-class works; blue → view-class works. Paste reports into #28 |

## After the 3a probe verdict

- Red/blue H1 → keep the body-class sync as a documented theme hook; record in `docs/theming.md`.
- Underline only → body-class sync stays harmless-but-inert for the print DOM; document that themes cannot hook the PDF and the state-baked rules are the only path.
- Either way: remove the probe command + `src/document/print-probe.ts`, and update #25's watermark anchor if the DOM dump shows a better one.
