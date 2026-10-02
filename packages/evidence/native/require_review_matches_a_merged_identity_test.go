package evidence

import (
  "testing"
)

/**
 * Verifies a review on one half of a merged identity answers a citation on the
 * other, under requireReview.
 *
 * The two rules of this package must agree about the same file.
 * `evidence/review` judges an identity, so it accepts a citation on
 * `interface ISale` reviewed from `namespace ISale`. Matching reviews by
 * `HostID`, which is a source position, would give the two halves different keys
 * and `requireReview` would report the same file unreviewed. `model.go` states
 * the hazard where it defines the field: HostID is the position identity and
 * policy must not confuse it with the public symbol identity it represents.
 * Matching is by semantic host identity.
 *
 *  1. Declare `interface ISale` beside `namespace ISale` in a claim file.
 *  2. Put the citation on the interface and its review, with the expected
 *     fingerprint, on the namespace.
 *  3. Assert the graph is clean.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule obtains a token for an interface citation and accepts its review on namespace ISale in the same merged symbol.
 * @evidence contracts/testing.md#independent-expectations Review matching follows semantic host identity across interface/namespace declarations. The rule-produced token is setup and does not certify fingerprint correctness.
 * @evidence contracts/testing.md#distinguishing-cases Citation and review reside on different physical declaration blocks of one identity; another identity's refusal belongs to RequireReviewRefusesAReviewOnAnotherIdentity.
 * @evidence contracts/testing.md#execution-ownership TestRequireReviewMatchesAMergedIdentity is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
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
