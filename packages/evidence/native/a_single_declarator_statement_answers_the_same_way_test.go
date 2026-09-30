package evidence

import (
  "testing"
)

/**
 * Verifies a single-declarator statement answers the same way.
 *
 * The ordinary shape is the one every existing fingerprint assertion is written
 * against, and it is the one where the statement wrapper and the declarator
 * differ by only the `export const` prefix. Without this, the two complementary cases
 * would keep passing if the repair had quietly changed which edits an ordinary
 * variable responds to.
 *
 * The *value* is not preserved and is not asserted to be. Narrowing content
 * from three nodes to one moves every variable unit's digest once, which is a
 * migration the documentation records rather than a property a case can pin.
 *
 *  1. Digest a single-declarator statement carrying a block.
 *  2. Reword the block, then change the initializer.
 *  3. Assert the first did not move it and the second did.
 * @evidence contracts/testing.md#behavioral-verification variableDigestOf exercises the authored fixture. Assert the first did not move it and the second did.
 * @evidence contracts/testing.md#independent-expectations The ordinary shape is the one every existing fingerprint assertion is written against, and it is the one where the statement wrapper and the declarator differ by only the `export const` prefix. Without this, the two complementary cases would keep passing if the repair had quietly changed which edits an ordinary variable responds to. The authored scenario requires this outcome: Assert the first did not move it and the second did.
 * @evidence contracts/testing.md#distinguishing-cases Digest a single-declarator statement carrying a block. Reword the block, then change the initializer. Assert the first did not move it and the second did.
 * @evidence contracts/testing.md#execution-ownership TestASingleDeclaratorStatementAnswersTheSameWay runs as a Go unit entry in the native package. variableDigestOf executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestASingleDeclaratorStatementAnswersTheSameWay(t *testing.T) {
  first := variableDigestOf(t, "limit", `/** First wording. */
export const limit = 1;
`)
  reworded := variableDigestOf(t, "limit", `/** Second wording, longer and entirely different. */
export const limit = 1;
`)
  if first != reworded {
    t.Fatal("rewording a variable's own block moved its digest")
  }
  changed := variableDigestOf(t, "limit", `/** First wording. */
export const limit = 2;
`)
  if changed == first {
    t.Fatal("a variable's initializer left its digest unmoved")
  }
}
