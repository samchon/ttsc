package evidence

import (
  "testing"
)

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
 *
 * @evidence contracts/testing.md#behavioral-verification everyExpectedFingerprint obtains Pricing and Coupons tokens under overlapping H2 and H2/H3 references; both tokens must exist and one review per target must satisfy both references.
 * @evidence contracts/testing.md#independent-expectations Overlapping selectors over one structural target must accept the same review value; extracted values are setup, not independent expected digests.
 * @evidence contracts/testing.md#distinguishing-cases Two target ranks challenge selector-dependent fingerprints through accepted coverage, without asserting each diagnostic's proposed value separately.
 * @evidence contracts/testing.md#execution-ownership TestTwoRequireReviewReferencesAgreeOnOneFingerprint is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
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
