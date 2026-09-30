package evidence

import (
  "testing"
)

/**
 * Verifies comments never contribute a declaration and never end a block early.
 *
 * All three comment forms reach the scan, and each can lie in its own way: a
 * `//` line holding schema-shaped text would be read as a member, a `///` doc
 * line likewise, and a block comment containing a brace would close the model
 * from inside a comment. Prisma keeps block-comment text as documentation, so
 * it is genuinely present in the file the author sees, which is why it is
 * pinned rather than assumed away.
 *
 *  1. Scan a model whose members are separated by all three comment forms.
 *  2. Assert only the real members are located.
 *  3. Assert the commented-out member contributed nothing.
 *
 * @evidence contracts/testing.md#behavioral-verification scanPrismaFile finds real declarations and omits checked comment-only names.
 * @evidence contracts/testing.md#independent-expectations Authored source distinguishes declarations from commented text.
 * @evidence contracts/testing.md#distinguishing-cases Line/block comments must not contribute locations.
 * @evidence contracts/testing.md#execution-ownership TestPrismaCommentsDeclareNothing is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaCommentsDeclareNothing(t *testing.T) {
  locations := prismaLocationsOf(`model Sale {
  id String @id
  // retired Int
  /// a doc comment
  /* a block
     comment with } inside */
  price Int
}
`)
  assertPrismaLine(t, locations, "Sale.id", 2)
  assertPrismaLine(t, locations, "Sale.price", 7)
  for _, absent := range []string{"Sale.retired", "Sale.a", "Sale.comment"} {
    if _, leaked := locations[absent]; leaked {
      t.Fatalf("%q came from a comment", absent)
    }
  }
}
