package evidence

import (
  "testing"
)

/**
 * Verifies an exclusion is answered by `@evidenceExcludeReview` and a citation by
 * `@evidenceReview`.
 *
 * The two acknowledgements ask opposite questions and so do their reviews.
 * Verifying an `@evidence` means checking that this declaration does what the
 * cited unit describes. Verifying an `@evidenceExclude` means checking that the
 * unit genuinely does not apply here, which no reading of the declaration can
 * establish. One tag for both would let a review of the easier question discharge
 * the harder one, and would leave a reader unable to tell which was answered
 * without finding the sibling tag first.
 *
 *  1. One host cites one target and excludes another, each answered by its own
 *     review tag.
 *  2. Assert nothing is reported.
 *
 * @evidence contracts/testing.md#behavioral-verification runReviewRule sees a Pricing citation with evidenceReview and tax exclusion with evidenceExcludeReview; assertSilent requires valid pairing.
 * @evidence contracts/testing.md#independent-expectations Citation verification and exclusion verification use distinct markers, each answering its corresponding acknowledgement kind.
 * @evidence contracts/testing.md#distinguishing-cases Both kinds coexist on one host and different targets; swapped-kind refusal is owned by ReviewReportsAMismatchedReviewTag.
 * @evidence contracts/testing.md#execution-ownership TestReviewSeparatesTheTwoReviewTags is a selectable native Go unit entry. runReviewRule parses one supplied source and calls reviewRule.Check in-process with a captured reporter; no target artifact, installed consumer or real compiler host is needed.
 */
func TestReviewSeparatesTheTwoReviewTags(t *testing.T) {
  assertSilent(t, runReviewRule(t, "src/ISale.ts", `
/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReview docs/spec.md#pricing Section caps the rate at 30%; price clamps to 30.
 * @evidenceExclude docs/spec.md#tax The tax engine owns this, not the sale record.
 * @evidenceExcludeReview docs/spec.md#tax Read the section: every rule in it names a tax authority, none names a sale field.
 */
export interface ISale {
  price: number;
}
`))
}
