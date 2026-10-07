package evidence

import (
  "testing"
)

/**
 * Verifies two reviews of one target inside one block are still a duplicate.
 *
 * The negative twin of ReviewSurvivesACopiedDocumentationBlock. Loosening the count to per-block must not
 * loosen it to never, or the finding that catches a genuinely doubled review
 * disappears with the false positive.
 *
 *  1. One block cites a target once and reviews it twice.
 *  2. Assert the duplicate is reported.
 *
 * @evidence contracts/testing.md#behavioral-verification runReviewRule reads one citation and two reviews inside one interface block; assertReported requires exactly one duplicate finding.
 * @evidence contracts/testing.md#independent-expectations Relaxing copied-block handling must retain rejection of genuinely repeated reviews in the same block.
 * @evidence contracts/testing.md#distinguishing-cases One physical block isolates duplicate review count from the overload-copy case.
 * @evidence contracts/testing.md#execution-ownership TestReviewStillReportsTwoReviewsInOneBlock is a selectable native Go unit entry. runReviewRule parses one supplied source and calls reviewRule.Check in-process with a captured reporter; no target artifact, installed consumer or real compiler host is needed.
 */
func TestReviewStillReportsTwoReviewsInOneBlock(t *testing.T) {
  assertReported(
    t,
    runReviewRule(t, "src/ISale.ts", `
/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReview docs/spec.md#pricing Section caps the rate at 30%.
 * @evidenceReview docs/spec.md#pricing Read it again and it still says 30.
 */
export interface ISale {
  price: number;
}
`),
    "Duplicate @evidenceReview for 'docs/spec.md#pricing'",
  )
}
