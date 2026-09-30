package evidence

import (
  "testing"
)

/**
 * Verifies a rejected fingerprint token is not accepted as the description.
 *
 * `#A3F9C1D` is a fingerprint whose case is wrong, not a verification statement.
 * Treating it as prose let the shortest wrong path an author can take pass in
 * silence: paste the expected value out of the diagnostic, get the case wrong,
 * stop, and ship a review that states nothing while satisfying the non-empty
 * test. Case was all that separated the caught form from the uncaught one.
 *
 *  1. Review a citation with an uppercase token and nothing else.
 *  2. Assert it is reported as malformed.
 *  3. Assert a `#`-opening token followed by real prose still keeps that prose,
 *     because a requirement anchor is spelled the same way.
 * @evidence contracts/testing.md#behavioral-verification runReviewRule must report an uppercase fingerprint-only review malformed, then accept a requirement-anchor token followed by real prose.
 * @evidence contracts/testing.md#independent-expectations Token-looking text alone provides no verification explanation; an anchor with prose is a legitimate description.
 * @evidence contracts/testing.md#distinguishing-cases Uppercase bare token versus a longer anchor plus prose detects case loopholes without rejecting every hash-opening review.
 * @evidence contracts/testing.md#execution-ownership TestReviewRejectsAFingerprintOnlyDescription is a selectable native Go unit entry. runReviewRule parses one supplied source and calls reviewRule.Check in-process with a captured reporter; no target artifact, installed consumer or real compiler host is needed.
 */
func TestReviewRejectsAFingerprintOnlyDescription(t *testing.T) {
  assertReported(
    t,
    runReviewRule(t, "src/ISale.ts", `
/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReview docs/spec.md#pricing #A3F9C1D
 */
export interface ISale {
  price: number;
}
`),
    "Malformed @evidenceReview for 'docs/spec.md#pricing'",
  )
  assertSilent(t, runReviewRule(t, "src/IFind.ts", `
/**
 * @evidence docs/spec.md#search Renders the standard product card.
 * @evidenceReview docs/spec.md#search #req-search-policies names the card fields; all three render.
 */
export interface IFind {
  card: string;
}
`))
}
