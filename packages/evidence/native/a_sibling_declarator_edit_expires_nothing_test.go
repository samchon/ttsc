package evidence

import (
  "testing"
)

/**
 * Verifies a sibling declarator's edit expires nothing.
 *
 * TypeScript attaches a variable's leading documentation to the statement
 * wrapper, so the wrapper is a position the identity owns and every consumer
 * that walks a unit's nodes has to reach it. It is not the identity's content:
 * one wrapper declares every sibling, so taking content from it put each
 * declarator's text inside every other declarator's digest, and an edit to one
 * identity expired a review of another.
 *
 * The own-initializer edit is the negative twin, and it is the one that fails
 * if the repair narrows the content to the binding alone.
 *
 *  1. Digest the first declarator of a two-declarator statement.
 *  2. Change only the second declarator's initializer.
 *  3. Assert the first is unmoved, then assert its own initializer still moves
 *     it.
 * @evidence contracts/testing.md#behavioral-verification variableDigestOf returns the alpha digest for `export const alpha = 1, /** First wording. *\/ beta = 2;`; the test requires it to equal the alpha digest when only beta's initializer changes to 3, and to differ when alpha's own initializer changes to 9.
 * @evidence contracts/testing.md#independent-expectations The expected relation follows from the review-expiry contract rather than from the digest code: an edit to a sibling declarator must not expire a review of another identity, but a change to the identity's own initializer must.
 * @evidence contracts/testing.md#distinguishing-cases A negative case (sibling initializer edit, equality required) and its positive twin (own initializer edit, inequality required), so a digest that ignored the declarator's content or one that included its siblings would each fail one assertion.
 * @evidence contracts/testing.md#execution-ownership TestASiblingDeclaratorEditExpiresNothing is a Go unit entry in the native test process; variableDigestOf parses each source with the TypeScript parser and reads the inventory digest, with no consumer install or product host.
 */
func TestASiblingDeclaratorEditExpiresNothing(t *testing.T) {
  first := variableDigestOf(t, "alpha", `export const alpha = 1,
  /** First wording. */
  beta = 2;
`)
  sibling := variableDigestOf(t, "alpha", `export const alpha = 1,
  /** First wording. */
  beta = 3;
`)
  if first != sibling {
    t.Fatal("a sibling declarator's initializer moved this identity's digest, so an unrelated edit expires its review")
  }
  own := variableDigestOf(t, "alpha", `export const alpha = 9,
  /** First wording. */
  beta = 2;
`)
  if own == first {
    t.Fatal("this identity's own initializer left its digest unmoved, so a real content change expires nothing")
  }
}
