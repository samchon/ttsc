package evidence

import (
  "testing"
)

/**
 * Verifies a tag the parser does attach is not reported.
 *
 * Every case above asserts that something new is said, and a reporter that says
 * it about every tag would satisfy all of them while making the rule unusable.
 * This is the population the repair must leave silent, and it is the ordinary
 * one: a block above a declaration, which is where citations are written.
 *
 *  1. Cite a section from a documentation block on a declaration.
 *  2. Evaluate the same claim.
 *  3. Assert nothing is reported at all.
 *
 * @evidence contracts/testing.md#behavioral-verification runUnreadableRule returns no problems when the ordinary leading documentation block cites pricing from limit.
 * @evidence contracts/testing.md#independent-expectations The supported JSDoc host and valid literal section citation must both be accepted. Silence is derived from the authored complete graph, rather than used as the expectation for malformed positions.
 * @evidence contracts/testing.md#distinguishing-cases One ordinary attached tag is the negative control for unreadable pattern and line-comment cases; it would fail if the scanner reported every tag indiscriminately.
 * @evidence contracts/testing.md#execution-ownership TestAnAttachedTagIsNotReported is the Go unit entry discovered beside the native package. runUnreadableRule parses the authored TypeScript fixture and checks its graph in that process; the helper owns the shared satisfied pricing section, while this entry owns its comment positions and assertions.
 */
func TestAnAttachedTagIsNotReported(t *testing.T) {
  assertNoProblems(t, runUnreadableRule(t, `/** @evidence docs/spec.md#pricing The declaration cites this. */
export const limit = 1;
`))
}
