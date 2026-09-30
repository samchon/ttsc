package evidence

import (
  "testing"
)

/**
 * Verifies an exclusion in the same position is reported.
 *
 * The exclusion is the worse of the two to lose. Its reason field makes it read
 * as a reviewed decision to leave something uncovered, so an author who writes
 * one and hears nothing believes a judgement was recorded when none was.
 *
 *  1. Write an exclusion between the braces of a destructuring pattern.
 *  2. Evaluate the same claim.
 *  3. Assert the tag is reported.
 * @evidence contracts/testing.md#behavioral-verification runUnreadableRule must include Unreadable @evidenceExclude at src/contracts.ts:4 for an exclusion inside the pattern.
 * @evidence contracts/testing.md#independent-expectations An exclusion requires a readable host just as a citation does. The literal tag kind and authored fourth line require a diagnostic instead of silently recording an exclusion.
 * @evidence contracts/testing.md#distinguishing-cases The pattern carries an inner exclusion and a valid outer citation. Citation and review siblings own the other tag kinds; this assertion accepts additional diagnostics.
 * @evidence contracts/testing.md#execution-ownership TestAnExclusionInsideAPatternIsReported is the Go unit entry discovered beside the native package. runUnreadableRule parses the authored TypeScript fixture and checks its graph in that process; the helper owns the shared satisfied pricing section, while this entry owns its comment positions and assertions.
 */
func TestAnExclusionInsideAPatternIsReported(t *testing.T) {
  assertReportedAmong(t, runUnreadableRule(t, `declare const source: { gamma: number; delta: number };
/** @evidence docs/spec.md#pricing The statement cites this. */
export const {
  /** @evidenceExclude docs/spec.md#pricing A decision nothing recorded. */
  gamma,
  delta,
} = source;
`), "Unreadable @evidenceExclude at src/contracts.ts:4")
}
