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
 * @evidence contracts/testing.md#behavioral-verification variableDigestOf exercises the authored fixture. Assert the first is unmoved, then assert its own initializer still moves it.
 * @evidence contracts/testing.md#independent-expectations TypeScript attaches a variable's leading documentation to the statement wrapper, so the wrapper is a position the identity owns and every consumer that walks a unit's nodes has to reach it. It is not the identity's content: one wrapper declares every sibling, so taking content from it put each declarator's text inside every other declarator's digest, and an edit to one identity expired a review of another. The authored scenario requires this outcome: Assert the first is unmoved, then assert its own initializer still moves it.
 * @evidence contracts/testing.md#distinguishing-cases Digest the first declarator of a two-declarator statement. Change only the second declarator's initializer. Assert the first is unmoved, then assert its own initializer still moves it.
 * @evidence contracts/testing.md#execution-ownership TestASiblingDeclaratorEditExpiresNothing runs as a Go unit entry in the native package. variableDigestOf executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
