package evidence

import (
  "strings"
  "testing"
)

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
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule reports unresolved Refunds beside a Pricing citation carrying an unfingerprinted review; messages naming Refunds must not also name an evidence-review derivative.
 * @evidence contracts/testing.md#independent-expectations Resolution failure cannot establish a review obligation for a nonexistent target.
 * @evidence contracts/testing.md#distinguishing-cases The invalid Refunds citation shares a host with Pricing and its review tag. Only Refunds derivative suppression is asserted; this case does not independently establish that Pricing review processing still acts.
 * @evidence contracts/testing.md#execution-ownership TestUnresolvedTargetProducesNoReviewFinding is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
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
