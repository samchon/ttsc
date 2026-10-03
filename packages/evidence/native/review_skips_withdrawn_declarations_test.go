package evidence

import (
  "testing"
)

/**
 * Verifies a declaration withdrawn from the public surface owes no review.
 *
 * `@internal`, `@hidden`, and `@ignore` each materialize no unit, and neither
 * does anything nested inside one. A withdrawn declaration is therefore not a
 * claim host and cannot carry a citation the graph will read, so demanding a
 * review there would send an author to write one for a tag that discharges
 * nothing. The rule inherits the withdrawal by collecting hosts through the same
 * collector the graph uses rather than walking exports itself.
 *
 *  1. Export an interface whose block carries `@internal` and an unreviewed
 *     citation.
 *  2. Assert the rule reports nothing.
 *
 * @evidence contracts/testing.md#behavioral-verification runReviewRule evaluates an @internal interface carrying an unreviewed citation; assertSilent requires no finding.
 * @evidence contracts/testing.md#independent-expectations A withdrawn identity is outside the public review population, so its citation owes no public review.
 * @evidence contracts/testing.md#distinguishing-cases The internal marker challenges collector filtering; hidden and ignore markers or nested withdrawal are not individually executed here.
 * @evidence contracts/testing.md#execution-ownership TestReviewSkipsWithdrawnDeclarations is a selectable native Go unit entry. runReviewRule parses one supplied source and calls reviewRule.Check in-process with a captured reporter; no target artifact, installed consumer or real compiler host is needed.
 */
func TestReviewSkipsWithdrawnDeclarations(t *testing.T) {
  assertSilent(t, runReviewRule(t, "src/ISale.ts", `
/**
 * @internal
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 */
export interface ISale {
  price: number;
}
`))
}
