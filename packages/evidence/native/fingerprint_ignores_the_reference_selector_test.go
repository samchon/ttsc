package evidence

import (
  "testing"
)

/**
 * Verifies a fingerprint covers the cited scope's subtree even when the
 * reference selects none of it.
 *
 * This is the defect an Individual Self-Review caught, and it made the feature's
 * central documented claim false. The digest was composed from
 * `reference.Units` and `reference.Scopes`, and both are narrowed by the
 * reference's `symbol` selector: an unselected descendant appears in neither. A
 * Markdown reference selecting only `h2` therefore fingerprinted a cited section
 * without the H3 bodies inside it, so rewriting that subtree expired nothing and
 * the review stayed green forever.
 *
 * The earlier subtree case hid it by selecting `["h2","h3"]`, which put the
 * descendants back into the selection. This one keeps the selector at `h2`,
 * which is what a consumer who only wants H2 obligations actually writes.
 *
 *  1. Select only `h2`, cite an H2 that contains an H3, review it with the
 *     expected value.
 *  2. Assert the graph is clean.
 *  3. Rewrite only the H3's body, which the reference does not select at all,
 *     and assert the review is now stale.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule selects H2 only, reviews Pricing, then rewrites its unselected H3 Coupons and requires stale Pricing.
 * @evidence contracts/testing.md#independent-expectations A selected ancestor's structural fingerprint includes descendants independently of the obligation selector. The seed is production-derived and cannot verify exact hash computation.
 * @evidence contracts/testing.md#distinguishing-cases An H3 excluded from selection still changes the aggregate; accepted baseline prevents testing only that any token is rejected.
 * @evidence contracts/testing.md#execution-ownership TestFingerprintIgnoresTheReferenceSelector is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestFingerprintIgnoresTheReferenceSelector(t *testing.T) {
  before := "## Pricing\n\nThe rate is capped.\n\n### Coupons\n\nOne per issuer.\n"
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
 * @evidenceReview docs/spec.md#pricing #` + fingerprint + ` Read the cap and the coupon rule; price honors each.
 */
export interface ISale {
  price: number;
}
`
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec.md": before,
    "src/ISale.ts": reviewed,
  }, requireReviewConfig))

  after := "## Pricing\n\nThe rate is capped.\n\n### Coupons\n\nTwo per issuer.\n"
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "docs/spec.md": after,
    "src/ISale.ts": reviewed,
  }, requireReviewConfig), "Stale @evidenceReview for 'docs/spec.md#pricing'")
}
