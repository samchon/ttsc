package evidence

import (
  "testing"
)

/**
 * Verifies only the exact marker opens a review, and only a shaped token is a
 * fingerprint.
 *
 * Two boundaries are pinned together because both fail silently in opposite
 * directions. A marker matched by prefix would swallow `@evidenceReviewed`, so
 * some other tool's tag would start answering for a citation nobody reviewed. A
 * fingerprint inferred from a bare hex word would eat a description opening with
 * `#req-...`, which is exactly how the requirement anchors in this project's own
 * benchmark are spelled, and the author would then be told their fingerprint is
 * malformed when they never wrote one.
 *
 *  1. One interface cites two targets and writes `@evidenceReviewed` for the
 *     first, so no review exists for it.
 *  2. The second review's description opens with `#req-search-policies`, which is
 *     `#`-prefixed and neither seven characters nor hex.
 *  3. Assert only the first target is reported, so the anchor stayed prose.
 */
func TestReviewJudgesTheBoundaryOfItsMarker(t *testing.T) {
  messages := runReviewRule(t, "src/ISale.ts", `
/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReviewed docs/spec.md#pricing Not this rule's tag.
 * @evidence docs/spec.md#search Renders the standard product card.
 * @evidenceReview docs/spec.md#search #req-search-policies names the card fields; all three render.
 */
export interface ISale {
  price: number;
}
`)
  assertReported(t, messages, "Unreviewed @evidence for 'docs/spec.md#pricing'")
}
