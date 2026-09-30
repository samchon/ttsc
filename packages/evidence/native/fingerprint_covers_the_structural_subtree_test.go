package evidence

import (
  "testing"
)

/**
 * Verifies a citation of an aggregate scope expires when its subtree changes.
 *
 * A citation acknowledges the target and every selected descendant, so a review
 * of that citation is a review of the whole scope. If the fingerprint covered
 * only the named unit, an author could cite an H1, discharge fourteen headings
 * beneath it, and keep a green review while every one of those headings was
 * rewritten. Covering the subtree is what makes the review's scope match the
 * citation's scope.
 *
 * The subtree is structural rather than a reference's covered set, and that is
 * load-bearing: `UnitsByScope` is built per reference while a tag carries exactly
 * one fingerprint token, so two references citing one scope under different
 * `symbol` selectors would otherwise demand two values from one token.
 *
 *  1. Cite an H2 that contains an H3, and review it with the expected value.
 *  2. Assert the graph is clean.
 *  3. Rewrite only the H3's body and assert the H2 citation's review is stale.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule reviews Pricing with H2/H3 selected, then changing only descendant Coupons must report stale Pricing.
 * @evidence contracts/testing.md#independent-expectations An aggregate H2 fingerprint covers its structural descendants; the seed comes from the rule, while the expected change follows independently from subtree coverage.
 * @evidence contracts/testing.md#distinguishing-cases The baseline must accept the token before One becomes Two in the H3; no assertion of the exact hash algorithm is made.
 * @evidence contracts/testing.md#execution-ownership TestFingerprintCoversTheStructuralSubtree is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestFingerprintCoversTheStructuralSubtree(t *testing.T) {
  config := `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "files":["docs/**/*.md"],
      "symbol":["h2","h3"],
      "requireReview":true
    }
  }]}`
  before := "## Pricing\n\nThe rate is capped.\n\n### Coupons\n\nOne per issuer.\n"
  bare := `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this whole section.
 */
export interface ISale {
  price: number;
}
`
  fingerprint := reviewedFingerprintAt(t, map[string]string{
    "docs/spec.md": before,
    "src/ISale.ts": bare,
  }, config)
  reviewed := `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this whole section.
 * @evidenceReview docs/spec.md#pricing #` + fingerprint + ` Read both the cap and the coupon rule; price honors each.
 */
export interface ISale {
  price: number;
}
`
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec.md": before,
    "src/ISale.ts": reviewed,
  }, config))

  after := "## Pricing\n\nThe rate is capped.\n\n### Coupons\n\nTwo per issuer.\n"
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "docs/spec.md": after,
    "src/ISale.ts": reviewed,
  }, config), "Stale @evidenceReview for 'docs/spec.md#pricing'")
}
