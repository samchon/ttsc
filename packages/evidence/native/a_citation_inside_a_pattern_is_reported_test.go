package evidence

import (
  "testing"
)

/**
 * Verifies a citation between the braces of a pattern is reported.
 *
 * TypeScript attaches no documentation to a binding element, so this block
 * reaches no node: the tag in it lands on no host and is cut out of no digest.
 * Discarding it in silence left an author reading a citation that does nothing,
 * while the coverage diagnostic that followed named the reference and suggested
 * writing the citation they had already written.
 *
 *  1. Write a citation between the braces of a destructuring pattern.
 *  2. Evaluate a claim selecting the variables it declares.
 *  3. Assert the tag is reported at its own line.
 * @evidence contracts/testing.md#behavioral-verification runUnreadableRule must include Unreadable @evidence at src/contracts.ts:4 for a block inside an object binding pattern.
 * @evidence contracts/testing.md#independent-expectations Binding-element comments do not become JSDoc hosts under the supported grammar. The authored fourth line fixes the diagnostic location independently of the scanner.
 * @evidence contracts/testing.md#distinguishing-cases A valid statement-level citation discharges pricing, while the inner pattern block remains unreadable. assertReportedAmong checks this finding without certifying the complete diagnostic set.
 * @evidence contracts/testing.md#execution-ownership TestACitationInsideAPatternIsReported is the Go unit entry discovered beside the native package. runUnreadableRule parses the authored TypeScript fixture and checks its graph in that process; the helper owns the shared satisfied pricing section, while this entry owns its comment positions and assertions.
 */
func TestACitationInsideAPatternIsReported(t *testing.T) {
  assertReportedAmong(t, runUnreadableRule(t, `declare const source: { gamma: number; delta: number };
/** @evidence docs/spec.md#pricing The statement cites this. */
export const {
  /** @evidence docs/spec.md#pricing A tag between the braces. */
  gamma,
  delta,
} = source;
`), "Unreadable @evidence at src/contracts.ts:4")
}
