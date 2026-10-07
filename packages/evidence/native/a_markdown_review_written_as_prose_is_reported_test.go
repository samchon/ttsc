package evidence

import (
  "testing"
)

/**
 * Verifies a review written as prose is reported under the tag it was written
 * as.
 *
 * A review that reaches nothing can never expire and never satisfy anything,
 * which is the one outcome `requireReview` exists to make impossible. The two
 * review tags answer different questions, so the diagnostic has to name the one
 * the author actually wrote.
 *
 *  1. Write a review of an exclusion as an ordinary paragraph line.
 *  2. Evaluate the same claim.
 *  3. Assert it is reported as `@evidenceExcludeReview`.
 *
 * @evidence contracts/testing.md#behavioral-verification runProseTagRule runs graphRule.Check over docs/claim/plan.md ending in the paragraph line `@evidenceExcludeReview docs/spec/rules.md#pricing Read and agreed.`; assertReported requires exactly one diagnostic `Unreadable @evidenceExcludeReview at docs/claim/plan.md:5`.
 * @evidence contracts/testing.md#independent-expectations The expected tag name (the review tag the author wrote, not @evidence or @evidenceExclude) and line 5 are literals read off the authored fixture; the helper's valid comment citation discharges the obligation.
 * @evidence contracts/testing.md#distinguishing-cases This entry owns the exclusion-review tag only; the exactly-one assertion with the full tag name shows the report is not renamed to another tag. Other tags are covered by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestAMarkdownReviewWrittenAsProseIsReported is a Go unit entry in the native test process; runProseTagRule writes the Markdown fixture to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestAMarkdownReviewWrittenAsProseIsReported(t *testing.T) {
  assertReported(
    t,
    runProseTagRule(t, "@evidenceExcludeReview docs/spec/rules.md#pricing Read and agreed.\n"),
    "Unreadable @evidenceExcludeReview at docs/claim/plan.md:5",
  )
}
