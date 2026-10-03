package evidence

import (
  "testing"
)

/**
 * Verifies an `@evidenceExclude` owes a review, and the finding names that tag.
 *
 * The exclusion is where a review pays most and where it is easiest to forget.
 * An exclusion's reason is the least machine-checkable statement in the whole
 * plugin — nothing resolves against it, and the graph only demands that it be
 * non-empty — so a reviewed non-applicability decision is the one thing standing
 * between "we decided this does not apply" and "we did not build this".
 *
 * The tag name in the message is read from the citation rather than fixed,
 * because a finding that says `@evidence` about an `@evidenceExclude` names a
 * tag the author cannot find on the line it points at.
 *
 *  1. One exported interface carries an `@evidenceExclude` and no review.
 *  2. Assert the finding is reported and spells `@evidenceExclude`.
 *
 * @evidence contracts/testing.md#behavioral-verification runReviewRule sees an exported ISale exclusion without a review; assertReported requires exactly one tax finding spelling evidenceExclude.
 * @evidence contracts/testing.md#independent-expectations Exclusions owe a separately named review because they state non-applicability rather than implementation.
 * @evidence contracts/testing.md#distinguishing-cases This entry owns the missing-exclusion-review arm; correct and mismatched kinds are covered by ReviewSeparatesTheTwoReviewTags and ReviewReportsAMismatchedReviewTag.
 * @evidence contracts/testing.md#execution-ownership TestReviewReportsAnUnreviewedExclusion is a selectable native Go unit entry. runReviewRule parses one supplied source and calls reviewRule.Check in-process with a captured reporter; no target artifact, installed consumer or real compiler host is needed.
 */
func TestReviewReportsAnUnreviewedExclusion(t *testing.T) {
  assertReported(
    t,
    runReviewRule(t, "src/ISale.ts", `
/**
 * @evidenceExclude docs/spec.md#tax The tax engine owns this, not the sale record.
 */
export interface ISale {
  price: number;
}
`),
    "Unreviewed @evidenceExclude for 'docs/spec.md#tax'",
  )
}
