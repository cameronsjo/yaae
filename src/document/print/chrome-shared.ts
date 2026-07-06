/**
 * Shared derivations for both chrome strategies (margin boxes and fixed).
 * Banner visibility and text-baseline fragments are identical across the two;
 * keeping them here means a rule change (new banner position, new suppression
 * condition, a knob rename) is one edit, not two that can drift.
 */

import { getClassificationMeta } from '../../schemas/classification';
import type { ClassificationMeta } from '../../schemas/classification';
import type { PrintDocumentState } from './state';
import type { PrintVars } from './vars';

export interface BannerResolution {
  meta: ClassificationMeta | null;
  hasTopBanner: boolean;
  hasBottomBanner: boolean;
}

/** Resolve the classification banner visibility for a document. */
export function resolveBanner(state: PrintDocumentState): BannerResolution {
  const meta = state.classification
    ? getClassificationMeta(state.classification, state.customClassifications)
    : null;
  return {
    meta,
    hasTopBanner: meta !== null,
    // Signature block owns the bottom slot, so it suppresses the bottom banner.
    hasBottomBanner:
      meta !== null && state.bannerPosition === 'both' && !state.signatureBlock,
  };
}

/** Header/footer text baseline (shared; fixed strategy prepends position). */
export function chromeTextBase(vars: PrintVars): string {
  return `
    font-size: ${vars['--yaae-print-header-footer-font-size']};
    color: ${vars['--yaae-print-header-footer-color']};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;`;
}

/** Classification banner text baseline (shared; fixed strategy prepends position). */
export function bannerTextBase(vars: PrintVars): string {
  return `
    font-weight: 700;
    font-size: ${vars['--yaae-print-banner-font-size']};
    letter-spacing: ${vars['--yaae-print-banner-letter-spacing']};
    text-transform: uppercase;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;`;
}
