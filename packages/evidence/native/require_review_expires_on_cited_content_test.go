package evidence

import (
  "testing"
)

/**
 * Verifies a review passes while the cited content stands and fails once it
 * moves.
 *
 * This is the transformation direction, which is the whole product: a review
 * that never expires is written once and stays green forever, and on a second
 * pass over a large citation set nothing distinguishes a review written against
 * current content from one written against content that has since been rewritten.
 * Asserting only that a correct fingerprint passes would prove idempotency
 * instead.
 *
 *  1. Cite one H2 and review it with the fingerprint the graph asks for.
 *  2. Assert the graph is clean.
 *  3. Rewrite the body of that H2 and assert the same source now reports a stale
 *     review quoting the old value.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule accepts a token for Pricing at 30 percent, changes the same document body to 45 percent, then requires stale Pricing and quotation of the old token.
 * @evidence contracts/testing.md#independent-expectations A review of rewritten cited content expires; the expected transition is independent even though the initial token is obtained from the rule's diagnostic.
 * @evidence contracts/testing.md#distinguishing-cases Accepted-to-stale with unchanged source and heading isolates prose change. This entry uses an interface carrier only and does not assert an exact new hash.
 * @evidence contracts/testing.md#execution-ownership TestRequireReviewExpiresOnCitedContent is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestRequireReviewExpiresOnCitedContent(t *testing.T) {
  before := "## Pricing\n\nThe rate is capped at 30%.\n"
  bare := `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 */
export interface ISale {
  price: number;
}
`
  fingerprint := reviewedFingerprint(t, before, bare)
  reviewed := `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReview docs/spec.md#pricing #` + fingerprint + ` Section caps the rate at 30%; price clamps to 30.
 */
export interface ISale {
  price: number;
}
`
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec.md": before,
    "src/ISale.ts": reviewed,
  }, requireReviewConfig))

  after := "## Pricing\n\nThe rate is capped at 45%.\n"
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": after,
    "src/ISale.ts": reviewed,
  }, requireReviewConfig)
  assertProblemContains(t, messages, "Stale @evidenceReview for 'docs/spec.md#pricing'")
  assertProblemContains(t, messages, "names '#"+fingerprint+"'")
}
