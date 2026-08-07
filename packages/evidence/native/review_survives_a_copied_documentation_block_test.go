package evidence

import (
  "testing"
)

/**
 * Verifies one review per declaration of an identity is not a duplicate.
 *
 * An Individual Self-Review caught this. Citations were deduplicated across the
 * blocks of one identity and reviews were not, so an overload set written the
 * normal way — by copying the documentation block onto each signature — reported
 * `Duplicate @evidenceReview` while every citation was in fact reviewed exactly
 * once. The asymmetry was the defect; a duplicate is two reviews inside one
 * block, not one review on each half of an identity.
 *
 *  1. Declare two overload signatures, each carrying the same citation and the
 *     same review.
 *  2. Assert nothing is reported.
 */
func TestReviewSurvivesACopiedDocumentationBlock(t *testing.T) {
  assertSilent(t, runReviewRule(t, "src/price.ts", `
/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReview docs/spec.md#pricing Section caps the rate at 30%; both arms clamp to 30.
 */
export function price(input: string): number;
/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReview docs/spec.md#pricing Section caps the rate at 30%; both arms clamp to 30.
 */
export function price(input: number): number;
export function price(input: any): number {
  return 0;
}
`))
}

/**
 * Verifies two reviews of one target inside one block are still a duplicate.
 *
 * The negative twin of the case above. Loosening the count to per-block must not
 * loosen it to never, or the finding that catches a genuinely doubled review
 * disappears with the false positive.
 *
 *  1. One block cites a target once and reviews it twice.
 *  2. Assert the duplicate is reported.
 */
func TestReviewStillReportsTwoReviewsInOneBlock(t *testing.T) {
  assertReported(
    t,
    runReviewRule(t, "src/ISale.ts", `
/**
 * @evidence docs/spec.md#pricing Derives the sale price from this section.
 * @evidenceReview docs/spec.md#pricing Section caps the rate at 30%.
 * @evidenceReview docs/spec.md#pricing Read it again and it still says 30.
 */
export interface ISale {
  price: number;
}
`),
    "Duplicate @evidenceReview for 'docs/spec.md#pricing'",
  )
}

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
