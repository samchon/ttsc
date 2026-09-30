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
 *
 * @evidence contracts/testing.md#behavioral-verification runReviewRule reads identical citation/review blocks on two overload signatures and requires silence.
 * @evidence contracts/testing.md#independent-expectations Repeated documentation on separate declarations of one semantic identity is valid; duplicates are judged inside a block rather than across copied overload blocks.
 * @evidence contracts/testing.md#distinguishing-cases Two signatures plus an implementation challenge physical-block versus merged-identity counting; targets are not resolved here.
 * @evidence contracts/testing.md#execution-ownership TestReviewSurvivesACopiedDocumentationBlock is a selectable native Go unit entry. runReviewRule parses one supplied source and calls reviewRule.Check in-process with a captured reporter; no target artifact, installed consumer or real compiler host is needed.
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
