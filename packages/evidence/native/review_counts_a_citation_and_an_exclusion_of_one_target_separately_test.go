package evidence

import (
  "testing"
)

/**
 * Verifies one target cited by one claim and excluded for another owes two reviews.
 *
 * The single-tag design could not express this at all: keyed on the target alone,
 * one review answered both decisions. They are two decisions — this code implements
 * the section, and this other claim does not cover it — so they owe two
 * verifications, and a host may legitimately carry both tags for one target.
 *
 *  1. One host both cites and excludes the same target.
 *  2. Review only the citation.
 *  3. Assert the exclusion is still reported as unreviewed, and the citation is
 *     not.
 *
 * @evidence contracts/testing.md#behavioral-verification runReviewRule both cites and excludes Pricing, reviewing only the citation; assertReported requires exactly the unreviewed exclusion.
 * @evidence contracts/testing.md#independent-expectations Review ledger identity includes acknowledgement kind as well as target, so one review cannot discharge two opposite decisions.
 * @evidence contracts/testing.md#distinguishing-cases Identical target and host eliminate target spelling as the difference; only the kind changes the review obligation.
 * @evidence contracts/testing.md#execution-ownership TestReviewCountsACitationAndAnExclusionOfOneTargetSeparately is a selectable native Go unit entry. runReviewRule parses one supplied source and calls reviewRule.Check in-process with a captured reporter; no target artifact, installed consumer or real compiler host is needed.
 */
func TestReviewCountsACitationAndAnExclusionOfOneTargetSeparately(t *testing.T) {
  messages := runReviewRule(t, "src/ISale.ts", `
/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReview docs/spec.md#pricing Section caps the rate at 30%; price clamps to 30.
 * @evidenceExclude docs/spec.md#pricing A second claim does not cover this section.
 */
export interface ISale {
  price: number;
}
`)
  assertReported(
    t,
    messages,
    "Unreviewed @evidenceExclude for 'docs/spec.md#pricing'",
  )
}
