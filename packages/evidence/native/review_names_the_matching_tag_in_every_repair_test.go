package evidence

import (
  "testing"
)

/**
 * Verifies an unreviewed exclusion is told to write the exclusion review tag.
 *
 * A repair naming `@evidenceReview` would send the author of an exclusion to write
 * the tag that does not answer it, which is the one mistake the split exists to
 * prevent. The finding also states which question is open, because "nothing states
 * what was verified" does not say what verification would mean here.
 *
 *  1. One host carries an unreviewed exclusion and an unreviewed citation.
 *  2. Assert each repair names its own tag, and each finding states its own
 *     question.
 *
 * @evidence contracts/testing.md#behavioral-verification runReviewRule leaves one citation and one exclusion unreviewed; both Add-marker repairs and their distinct question text must be present.
 * @evidence contracts/testing.md#independent-expectations The repair for an exclusion must ask for evidenceExcludeReview and its non-applicability check; a citation asks for evidenceReview and implementation verification.
 * @evidence contracts/testing.md#distinguishing-cases Two unreviewed kinds on one host expose marker substitution or generic question text without asserting an exact diagnostic count.
 * @evidence contracts/testing.md#execution-ownership TestReviewNamesTheMatchingTagInEveryRepair is a selectable native Go unit entry. runReviewRule parses one supplied source and calls reviewRule.Check in-process with a captured reporter; no target artifact, installed consumer or real compiler host is needed.
 */
func TestReviewNamesTheMatchingTagInEveryRepair(t *testing.T) {
  messages := runReviewRule(t, "src/ISale.ts", `
/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceExclude docs/spec.md#tax The tax engine owns this, not the sale record.
 */
export interface ISale {
  price: number;
}
`)
  assertReportedAmong(
    t,
    messages,
    "Add '@evidenceReview docs/spec.md#pricing <what you checked>'",
  )
  assertReportedAmong(
    t,
    messages,
    "Add '@evidenceExcludeReview docs/spec.md#tax <what you checked>'",
  )
  assertReportedAmong(
    t,
    messages,
    "The exclusion states that this claim does not cover that target.",
  )
  assertReportedAmong(
    t,
    messages,
    "The citation states why this declaration answers for that target.",
  )
}
