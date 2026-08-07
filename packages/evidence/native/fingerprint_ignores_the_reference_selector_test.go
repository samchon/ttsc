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

/**
 * Verifies two references over one cited scope agree on one fingerprint.
 *
 * A tag carries exactly one fingerprint token, so if the expected value depended
 * on the reference asking for it, two `requireReview` references selecting
 * different symbol kinds would demand two different values and **no value an
 * author could write would make the build green**. That is not a noisy
 * diagnostic, it is a dead end, and it was reachable from documented
 * configuration before the fix.
 *
 *  1. Declare two Markdown references over the same files, one selecting `h2`
 *     and one selecting both `h2` and `h3`, both requiring review.
 *  2. Cite an H2 containing an H3 and review it with the value the graph names.
 *  3. Assert the graph is clean, so one token satisfied both obligations.
 */
func TestTwoRequireReviewReferencesAgreeOnOneFingerprint(t *testing.T) {
  config := `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"type",
    "reference":[
      {
        "type":"markdown",
        "files":["docs/**/*.md"],
        "symbol":"h2",
        "requireReview":true
      },
      {
        "type":"markdown",
        "files":["docs/**/*.md"],
        "symbol":["h2","h3"],
        "requireReview":true
      }
    ]
  }]}`
  document := "## Pricing\n\nThe rate is capped.\n\n### Coupons\n\nOne per issuer.\n"
  bare := `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this whole section.
 * @evidence docs/spec.md#coupons Applies the per-issuer coupon rule.
 */
export interface ISale {
  price: number;
}
`
  fingerprints := everyExpectedFingerprint(t, map[string]string{
    "docs/spec.md": document,
    "src/ISale.ts": bare,
  }, config)
  pricing := fingerprints["docs/spec.md#pricing"]
  coupons := fingerprints["docs/spec.md#coupons"]
  if pricing == "" || coupons == "" {
    t.Fatalf("expected an expected-fingerprint for both targets, got %v", fingerprints)
  }
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec.md": document,
    "src/ISale.ts": `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this whole section.
 * @evidenceReview docs/spec.md#pricing #` + pricing + ` Read the cap and the coupon rule; price honors each.
 * @evidence docs/spec.md#coupons Applies the per-issuer coupon rule.
 * @evidenceReview docs/spec.md#coupons #` + coupons + ` One per issuer, and price rejects a second.
 */
export interface ISale {
  price: number;
}
`,
  }, config))
}
