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
 * block above it, while an identifier reports no documentation of its own, so
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
 * @evidence contracts/testing.md#behavioral-verification variableDigestOf runs scanTypeScriptInventory over three authored sources and reads the Digest of unit 'beta' from each; the reworded-block source must digest equal to the original and the initializer-changed source (2 to 3) must digest differently.
 * @evidence contracts/testing.md#independent-expectations The expectation is a relation derived from the digest contract, not a digest literal: a documentation block, where a tag may sit, is excluded from a unit's content, while the initializer is content. Because no digest value is pinned, a digest that is wrongly computed but stable under both edits is only caught by the initializer arm.
 * @evidence contracts/testing.md#distinguishing-cases The negative arm rewords only the block above the second declarator of a shared statement (first declarator 'alpha' untouched); the positive arm changes only that declarator's initializer and must move the digest, so over-exclusion is distinguished from correct exclusion. Other declarators, top-level blocks and tag text are not varied here.
 * @evidence contracts/testing.md#execution-ownership TestRewordingAnInnerDeclaratorBlockExpiresNothing is a selectable native Go unit entry. parseTypeScriptInventory parses each source in memory with the TypeScript parser shim and scanTypeScriptInventory computes the digests in-process; no files are written to disk, and no consumer, build or product host is involved.
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
