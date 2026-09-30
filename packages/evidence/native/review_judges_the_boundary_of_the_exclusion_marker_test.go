package evidence

import (
  "testing"
)

/**
 * Verifies the marker boundary holds for the longer tag too.
 *
 * `@evidenceExcludeReviewed` is longer than the exact marker and must open
 * nothing, the same property `@evidenceReviewed` already pins. Without it a longer
 * tag from another tool would answer an exclusion nobody reviewed, and the
 * exclusion is the acknowledgement where a false review costs most.
 *
 *  1. Answer an exclusion with `@evidenceExcludeReviewed`.
 *  2. Assert the exclusion is still unreviewed.
 * @evidence contracts/testing.md#behavioral-verification runReviewRule answers a tax exclusion with evidenceExcludeReviewed; assertReported requires its unreviewed finding.
 * @evidence contracts/testing.md#independent-expectations A longer marker name must not be treated as the exact exclusion-review tag.
 * @evidence contracts/testing.md#distinguishing-cases This is the longer exclusion-marker negative arm; ordinary review-marker boundary is covered by ReviewJudgesTheBoundaryOfItsMarker.
 * @evidence contracts/testing.md#execution-ownership TestReviewJudgesTheBoundaryOfTheExclusionMarker is a selectable native Go unit entry. runReviewRule parses one supplied source and calls reviewRule.Check in-process with a captured reporter; no target artifact, installed consumer or real compiler host is needed.
 */
func TestReviewJudgesTheBoundaryOfTheExclusionMarker(t *testing.T) {
  assertReported(
    t,
    runReviewRule(t, "src/ISale.ts", `
/**
 * @evidenceExclude docs/spec.md#tax The tax engine owns this, not the sale record.
 * @evidenceExcludeReviewed docs/spec.md#tax Not this rule's tag.
 */
export interface ISale {
  price: number;
}
`),
    "Unreviewed @evidenceExclude for 'docs/spec.md#tax'",
  )
}
