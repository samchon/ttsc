package evidence

import (
  "testing"
)

/**
 * Verifies a review in the same position is reported.
 *
 * A review written where nothing reads it can never expire and never satisfy
 * anything, which is the one outcome `requireReview` exists to make impossible.
 *
 *  1. Write a review between the braces of a destructuring pattern.
 *  2. Evaluate the same claim.
 *  3. Assert the tag is reported under the name it was written as.
 * @evidence contracts/testing.md#behavioral-verification runUnreadableRule must include Unreadable @evidenceReview at src/contracts.ts:4 for the inner review block.
 * @evidence contracts/testing.md#independent-expectations A review in a binding-element comment has no documentation host and cannot satisfy review policy. The literal expected tag kind and line distinguish losing or misclassifying it.
 * @evidence contracts/testing.md#distinguishing-cases The valid outer citation keeps coverage satisfied, while the inner review contains a dummy digest. This case asserts unreadability rather than digest validation and permits additional findings.
 * @evidence contracts/testing.md#execution-ownership TestAReviewInsideAPatternIsReported is the Go unit entry discovered beside the native package. runUnreadableRule parses the authored TypeScript fixture and checks its graph in that process; the helper owns the shared satisfied pricing section, while this entry owns its comment positions and assertions.
 */
func TestAReviewInsideAPatternIsReported(t *testing.T) {
  assertReportedAmong(t, runUnreadableRule(t, `declare const source: { gamma: number; delta: number };
/** @evidence docs/spec.md#pricing The statement cites this. */
export const {
  /** @evidenceReview docs/spec.md#pricing #0000000 Read and agreed. */
  gamma,
  delta,
} = source;
`), "Unreadable @evidenceReview at src/contracts.ts:4")
}
