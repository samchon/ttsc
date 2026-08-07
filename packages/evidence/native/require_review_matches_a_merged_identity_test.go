package evidence

import (
  "testing"
)

/**
 * Verifies a review on one half of a merged identity answers a citation on the
 * other, under requireReview.
 *
 * Overall Self-Review round 6 caught this, and it was the two rules of this
 * package disagreeing about the same file. `evidence/review` judges an identity,
 * so it accepts a citation on `interface ISale` reviewed from `namespace ISale`.
 * The graph matched reviews by `HostID`, which is a source position, so the two
 * halves carried different keys and `requireReview` reported the same file
 * unreviewed. `model.go` states the hazard where it defines the field: HostID is
 * the position identity and policy must not confuse it with the public symbol
 * identity it represents. Matching is by semantic host identity now.
 *
 *  1. Declare `interface ISale` beside `namespace ISale` in a claim file.
 *  2. Put the citation on the interface and its review, with the expected
 *     fingerprint, on the namespace.
 *  3. Assert the graph is clean.
 */
func TestRequireReviewMatchesAMergedIdentity(t *testing.T) {
  document := "## Pricing\n\nThe rate is capped at 30%.\n"
  bare := `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 */
export interface ISale {
  price: number;
}

export namespace ISale {
  export type Kind = "retail";
}
`
  fingerprint := reviewedFingerprint(t, document, bare)
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec.md": document,
    "src/ISale.ts": `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 */
export interface ISale {
  price: number;
}

/**
 * @evidenceReview docs/spec.md#pricing #` + fingerprint + ` Section caps the rate at 30%; price clamps to 30.
 */
export namespace ISale {
  export type Kind = "retail";
}
`,
  }, requireReviewConfig))
}

/**
 * Verifies a review on an unrelated identity does not answer another's citation.
 *
 * The negative twin. Widening the match from a source position to a semantic
 * identity must not widen it to the whole file, or one review would discharge
 * every citation of that target anywhere in the module and the rule would be
 * satisfied by reviewing the easiest host.
 *
 *  1. Cite the target from one exported interface.
 *  2. Write the review on a different exported interface in the same file.
 *  3. Assert the citation is still reported as unreviewed.
 */
func TestRequireReviewRefusesAReviewOnAnotherIdentity(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing\n\nThe rate is capped at 30%.\n",
    "src/ISale.ts": `/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 */
export interface ISale {
  price: number;
}

/**
 * @evidenceReview docs/spec.md#pricing Checked the cap from somewhere else.
 */
export interface IOther {
  label: string;
}
`,
  }, requireReviewConfig), "Unreviewed @evidence for 'docs/spec.md#pricing'")
}
