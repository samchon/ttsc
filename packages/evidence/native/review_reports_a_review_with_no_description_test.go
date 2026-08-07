package evidence

import (
  "testing"
)

/**
 * Verifies a review with a target and no description is malformed.
 *
 * A review whose description is empty is the filler this rule exists to make
 * impossible to write silently, and it arrives in two shapes that must both be
 * caught: a bare target, and a target followed by a fingerprint and nothing
 * else. The second is the dangerous one, because pasting the expected
 * fingerprint out of a diagnostic and stopping there is the shortest path an
 * author can take, and it would otherwise satisfy the pairing check.
 *
 * A targetless review is reported without naming a target, since quoting the
 * empty string asks the author to look for something they did not write.
 *
 *  1. One interface cites two targets and reviews both with empty descriptions,
 *     one bare and one carrying only a fingerprint.
 *  2. A third review carries no target at all.
 *  3. Assert one malformed finding per review, and no orphan finding for the
 *     targetless one, which would name a second repair for one mistake.
 */
func TestReviewReportsAReviewWithNoDescription(t *testing.T) {
  messages := runReviewRule(t, "src/ISale.ts", `
/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReview docs/spec.md#pricing
 * @evidence docs/spec.md#refunds Applies the refund window this section sets.
 * @evidenceReview docs/spec.md#refunds #a3f9c1d
 * @evidenceReview
 */
export interface ISale {
  price: number;
}
`)
  assertReportedAmong(
    t,
    messages,
    "Malformed @evidenceReview for 'docs/spec.md#pricing'",
  )
  assertReportedAmong(
    t,
    messages,
    "Malformed @evidenceReview for 'docs/spec.md#refunds'",
  )
  assertReportedAmong(t, messages, "Malformed @evidenceReview on exported type")
  if count := countProblemsContaining(messages, "Orphan @evidenceReview"); count != 0 {
    t.Fatalf("expected no orphan finding beside a malformed one, got %d", count)
  }
}
