package evidence

import (
  "testing"
)

/**
 * Verifies the rule refuses options through the host's marker interface.
 *
 * `rule.OptionsRule` documents that a contributor rule defaults to *accepting*
 * options for backward compatibility, so the refusal has to be declared rather
 * than assumed: an unimplemented marker would let this rule take a configuration
 * object it never validates, and the host would pass it through in silence.
 * There is nothing to select here, since a citation on any public identity owes
 * a review, and per-directory scoping belongs in the outer `files` setting.
 *
 *  1. Read the rule's `AcceptsTtscLintOptions` declaration.
 *  2. Assert it refuses.
 */
func TestReviewTakesNoOptions(t *testing.T) {
  if reviewRule{}.AcceptsTtscLintOptions() {
    t.Fatal("evidence/review must refuse options so the host rejects a configured payload")
  }
}

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
