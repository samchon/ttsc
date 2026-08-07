package evidence

import (
  "testing"
)

/**
 * Verifies a citation with no review of its target is reported.
 *
 * This is the rule's whole purpose, and the negative twin of the passing case
 * is what proves the predicate acts rather than merely tolerating everything. A
 * review naming *another* target is used rather than no review at all, because
 * an absent review would also pass a rule that only counted tags: the pairing
 * has to be by target or an author discharges three citations with one review of
 * the easiest one.
 *
 *  1. One exported interface carries two citations.
 *  2. A single review names only the first target.
 *  3. Assert the second citation is reported as unreviewed, and that the
 *     reported repair names the target the author has to review.
 */
func TestReviewReportsAnUnreviewedCitation(t *testing.T) {
  messages := runReviewRule(t, "src/ISale.ts", `
/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReview docs/spec.md#pricing Section caps the rate at 30%; price() clamps to 30.
 * @evidence docs/spec.md#refunds Applies the refund window this section sets.
 */
export interface ISale {
  price: number;
}
`)
  assertReported(t, messages, "Unreviewed @evidence for 'docs/spec.md#refunds'")
  assertReportedAmong(
    t,
    messages,
    "Add '@evidenceReview docs/spec.md#refunds <what you checked>'",
  )
}
