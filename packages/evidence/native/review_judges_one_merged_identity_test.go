package evidence

import (
  "testing"
)

/**
 * Verifies a review on one declaration of a merged identity answers a citation
 * on another.
 *
 * The unit judged is an identity, never a declaration, which is the boundary
 * `evidence/documented` already uses and the one the graph judges citations on:
 * "A citation may sit on any declaration of a merged identity", so a review
 * restricted to the founding declaration would report a missing review for a
 * citation answered two lines away. Judging declarations instead would demand a
 * review on whichever half happens to carry the tag, which is placement the
 * graph itself calls not worth a diagnostic.
 *
 *  1. Declare `interface ISale` beside `namespace ISale`, one identity.
 *  2. Put the citation on the interface and its review on the namespace.
 *  3. Assert nothing is reported, so neither an unreviewed citation nor an
 *     orphan review was derived from the split.
 */
func TestReviewJudgesOneMergedIdentity(t *testing.T) {
  assertSilent(t, runReviewRule(t, "src/ISale.ts", `
/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 */
export interface ISale {
  price: number;
}

/**
 * @evidenceReview docs/spec.md#pricing Section caps the rate at 30%; price clamps to 30.
 */
export namespace ISale {
  export type Kind = "retail";
}
`))
}
