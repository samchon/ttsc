package evidence

import (
  "testing"
)

/**
 * Verifies a destructured leaf answers for the declarator it shares.
 *
 * The leaves of one pattern have no separate content: they are named by one
 * declarator and take their values from one initializer, so a change to that
 * initializer is a change to each of them and must expire every review of the
 * set. That is the shape a narrower repair would break, and the reason content
 * is stated per declaration rather than derived by narrowing to the smallest
 * node that spells the name.
 *
 * The block above the pattern is the negative twin: sharing a declarator must
 * not bring a tag position back into the digest by the side door.
 *
 *  1. Digest one leaf of a destructuring pattern.
 *  2. Change the shared initializer, then reword the block above the pattern.
 *  3. Assert the first moved it and the second did not.
 * @evidence contracts/testing.md#behavioral-verification variableDigestOf parses `export const { gamma, delta } = source;` and returns the gamma unit digest; the test compares it with the digest from a fixture whose initializer is a different variable (`other`) and from a fixture with a JSDoc block added above the pattern.
 * @evidence contracts/testing.md#independent-expectations The expectation comes from the review-expiry contract, not from the digest code: the leaves of one pattern share one declarator and initializer, so changing the initializer must change a leaf digest, while documentation above the pattern is excluded from it and must not.
 * @evidence contracts/testing.md#distinguishing-cases One positive change (initializer swapped, digests must differ) and one negative control (block comment added, digests must be equal) on the same leaf; only gamma is digested, so the delta leaf and other declarator forms are not asserted here.
 * @evidence contracts/testing.md#execution-ownership TestADestructuredLeafAnswersForItsSharedDeclarator is a Go unit entry in the native test process; variableDigestOf parses each source with the TypeScript parser and reads the inventory digest, with no consumer install or product host.
 */
func TestADestructuredLeafAnswersForItsSharedDeclarator(t *testing.T) {
  first := variableDigestOf(t, "gamma", `declare const source: { gamma: number; delta: number };
export const {
  gamma,
  delta,
} = source;
`)
  reinitialized := variableDigestOf(t, "gamma", `declare const source: { gamma: number; delta: number };
declare const other: { gamma: number; delta: number };
export const {
  gamma,
  delta,
} = other;
`)
  if reinitialized == first {
    t.Fatal("a destructured leaf ignored its own initializer, so the value it takes can change with nothing expiring")
  }
  documented := variableDigestOf(t, "gamma", `declare const source: { gamma: number; delta: number };
/** A block above the pattern. */
export const {
  gamma,
  delta,
} = source;
`)
  if documented != first {
    t.Fatal("a block above a destructuring pattern moved a leaf's digest, so writing a review there expires it")
  }
}
