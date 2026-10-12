package evidence

import (
  "strings"
  "testing"
)

/**
 * TestReviewPairsHeadingAnnotations verifies the `evidence/review` rule pairs
 * heading-form citations and reviews in either combination with the line
 * form.
 *
 * The rule asks whether every acknowledgement on a declaration has a review of
 * its kind naming the same target. A heading section and a line tag spell the
 * same acknowledgement, so a heading citation answered by a line review, a
 * line exclusion answered by a heading review, and a heading pair must all
 * satisfy it, while a heading citation with no review must not.
 *
 *  1. Pair heading and line forms in every combination on one interface.
 *  2. Require silence.
 *  3. Drop one review and require the rule to name the unreviewed citation.
 *
 * @evidence contracts/testing.md#behavioral-verification runReviewRule checks one interface whose JSDoc pairs a heading citation with a line review, a line exclusion with a heading review and a heading citation with a heading review, requiring no diagnostics; a second run removes the line review and requires a diagnostic naming `docs/spec.md#pricing`.
 * @evidence contracts/testing.md#independent-expectations Review pairing is keyed by acknowledgement kind and target, not by spelling, so every mixed pair is expected to satisfy the rule and the unpaired heading citation is expected to be reported.
 * @evidence contracts/testing.md#distinguishing-cases Three spelling combinations across both acknowledgement kinds, and the negative control that differs from the passing fixture only by one removed review line.
 * @evidence contracts/testing.md#execution-ownership TestReviewPairsHeadingAnnotations is a native Go unit entry; runReviewRule parses one supplied source and calls reviewRule.Check in-process with a captured reporter and no product host.
 */
func TestReviewPairsHeadingAnnotations(t *testing.T) {
  paired := `
/**
 * A sale.
 *
 * ## @evidence docs/spec.md#pricing
 *
 * Derives the price from this section.
 *
 * @evidenceReview docs/spec.md#pricing Read the cap and the clamp together.
 * @evidenceExclude docs/spec.md#billing Billing belongs to another service.
 *
 * ## @evidenceExcludeReview docs/spec.md#billing
 *
 * Confirmed that no billing field exists here.
 *
 * ## @evidence docs/spec.md#discount
 *
 * Applies the discount before the cap.
 *
 * ## @evidenceReview docs/spec.md#discount
 *
 * Traced the discount through the clamp.
 */
export interface ISale {
  price: number;
}
`
  assertSilent(t, runReviewRule(t, "src/ISale.ts", paired))

  line := " * @evidenceReview docs/spec.md#pricing Read the cap and the clamp together.\n"
  withoutReview := strings.Replace(paired, line, "", 1)
  if withoutReview == paired {
    t.Fatalf("the negative control must remove the review line %q", line)
  }
  assertProblemContains(t, runReviewRule(t, "src/ISale.ts", withoutReview), "docs/spec.md#pricing")
}
