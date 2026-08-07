package evidence

import (
  "testing"
)

/**
 * Verifies a review naming no citation is an orphan, and a repeated one is a
 * duplicate.
 *
 * Both are the rule reading in the other direction, and without them the rule is
 * one-way: an author could satisfy it by pasting reviews that answer nothing, or
 * leave two competing verifications of one citation where only one survives into
 * whatever a later reader trusts. The orphan case is what makes a mistyped
 * target a finding rather than a silent hole, since a typo turns one review into
 * an orphan and one citation into an unreviewed one.
 *
 *  1. One exported interface cites one target and reviews it twice.
 *  2. A third review names a target nothing cites.
 *  3. Assert exactly one duplicate finding and one orphan finding, and that the
 *     cited target itself is not also reported as unreviewed.
 */
func TestReviewReportsOrphanAndDuplicateReviews(t *testing.T) {
  messages := runReviewRule(t, "src/ISale.ts", `
/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReview docs/spec.md#pricing Section caps the rate at 30%; price() clamps to 30.
 * @evidenceReview docs/spec.md#pricing Read it again and it still says 30.
 * @evidenceReview docs/spec.md#refunds Checked the refund window.
 */
export interface ISale {
  price: number;
}
`)
  assertReportedAmong(
    t,
    messages,
    "Duplicate @evidenceReview for 'docs/spec.md#pricing'",
  )
  assertReportedAmong(
    t,
    messages,
    "Orphan @evidenceReview for 'docs/spec.md#refunds'",
  )
  if count := countProblemsContaining(messages, "Unreviewed @evidence"); count != 0 {
    t.Fatalf("expected no unreviewed finding for a cited and reviewed target, got %d", count)
  }
  if len(messages) != 2 {
    t.Fatalf("expected exactly two findings, got %d:\n%v", len(messages), messages)
  }
}
