package evidence

import (
  "testing"
)

/**
 * Verifies rewording an inner declarator's own block expires nothing.
 *
 * A digest excludes every position a tag can occupy, and this position was the
 * exception. A variable unit is created from its binding identifier, whose span
 * starts where the previous token ended and therefore arrives carrying the
 * block above it , while an identifier reports no documentation of its own, so
 * the exclusion had no span to cut. The declarator does report it, and taking
 * the identity's content from the declarator is what puts the block back inside
 * the exclusion.
 *
 * The initializer edit is the negative twin. Excluding too much would also
 * leave the digest unmoved, and a fingerprint that never moves expires nothing
 * at all.
 *
 *  1. Digest an inner declarator that carries a documentation block.
 *  2. Reword only that block.
 *  3. Assert the digest is unmoved, then assert its initializer still moves it.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification variableDigestOf exercises the authored fixture. Assert the digest is unmoved, then assert its initializer still moves it.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A digest excludes every position a tag can occupy, and this position was the exception. A variable unit is created from its binding identifier, whose span starts where the previous token ended and therefore arrives carrying the block above it , while an identifier reports no documentation of its own, so the exclusion had no span to cut. The declarator does report it, and taking the identity's content from the declarator is what puts the block back inside the exclusion. The authored scenario requires this outcome: Assert the digest is unmoved, then assert its initializer still moves it.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Digest an inner declarator that carries a documentation block. Reword only that block. Assert the digest is unmoved, then assert its initializer still moves it.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestRewordingAnInnerDeclaratorBlockExpiresNothing runs as a Go unit entry in the native package. variableDigestOf executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestRewordingAnInnerDeclaratorBlockExpiresNothing(t *testing.T) {
  first := variableDigestOf(t, "beta", `export const alpha = 1,
  /** First wording. */
  beta = 2;
`)
  reworded := variableDigestOf(t, "beta", `export const alpha = 1,
  /** Second wording, longer and entirely different. */
  beta = 2;
`)
  if first != reworded {
    t.Fatal("rewording an inner declarator's block moved its digest, so writing a review on one expires it")
  }
  changed := variableDigestOf(t, "beta", `export const alpha = 1,
  /** First wording. */
  beta = 3;
`)
  if changed == first {
    t.Fatal("an initializer change left the digest unmoved, so a real content change expires nothing")
  }
}
