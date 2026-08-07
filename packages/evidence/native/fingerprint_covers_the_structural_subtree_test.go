package evidence

import (
  "strings"
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

/**
 * Verifies a resolution failure produces no review finding.
 *
 * A citation whose target does not resolve has one repair, and the resolution
 * diagnostic names it. A review finding derived from the same tag would name a
 * second repair that cannot be performed until the first one is, and this plugin
 * already suppresses derivative findings for exactly that reason elsewhere.
 *
 *  1. Cite a heading no document declares, under a reference requiring review.
 *  2. Assert the unresolved-target diagnostic is reported and no review
 *     diagnostic accompanies it.
 */
func TestUnresolvedTargetProducesNoReviewFinding(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing\n\nThe rate is capped at 30%.\n",
    "src/ISale.ts": `/**
 * @evidence docs/spec.md#refunds Applies a refund window.
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReview docs/spec.md#pricing Section caps the rate at 30%; price clamps to 30.
 */
export interface ISale {
  price: number;
}
`,
  }, requireReviewConfig)
  assertProblemContains(t, messages, "Unresolved evidence target 'docs/spec.md#refunds'")
  // The property is that no *review* finding is derived from the unresolved
  // citation, so both halves are matched rather than one phrase that happened to
  // appear in the resolution message. An earlier form of this assertion counted
  // `for '<target>'`, which the resolution diagnostic spells `target '<target>'`,
  // so it counted zero and failed while the behavior under test was correct.
  for _, message := range messages {
    if strings.Contains(message, "@evidenceReview") &&
      strings.Contains(message, "docs/spec.md#refunds") {
      t.Fatalf("an unresolved citation produced a review finding:\n%s", message)
    }
  }
}
