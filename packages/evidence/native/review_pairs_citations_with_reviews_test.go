package evidence

import (
  "testing"
)

/**
 * Verifies a citation answered by a review of the same target passes.
 *
 * This is the shape the rule exists to make ordinary, so it is pinned before
 * every failing case: the reason and the description are addressed to two
 * different questions, and both sit in one block on one identity. Every target
 * form is covered in one pass because they share one splitter, and a form that
 * silently stopped matching would otherwise look like a rule that simply found
 * nothing to say.
 *
 *  1. One exported interface cites a Markdown section, a Swagger operation, and
 *     a symbol through an inline link.
 *  2. Each citation carries an `@evidenceReview` naming the identical target,
 *     one of them with a `#`-prefixed fingerprint the rule must not interpret.
 *  3. Assert the rule reports nothing.
 */
func TestReviewPairsCitationsWithReviews(t *testing.T) {
  assertSilent(t, runReviewRule(t, "src/ISale.ts", `
import type { IDiscount } from "./IDiscount";

/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReview docs/spec.md#pricing #a3f9c1d Section caps the rate at 30%; price() clamps to 30.
 * @evidence POST:/sales Creates the sale this operation publishes.
 * @evidenceReview POST:/sales Request body mirrors the operation's schema field for field.
 * @evidence {@link IDiscount} Mirrors the discount contract.
 * @evidenceReview {@link IDiscount} Every property of IDiscount appears here with the same type.
 */
export interface ISale {
  price: number;
}
`))
}
