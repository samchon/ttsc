package evidence

import (
  "testing"
)

/**
 * Verifies a blank line inside a block does not detach a citation.
 *
 * The negative twin of the detached-run case, and the reason both are measured
 * rather than reasoned about: Prisma attaches a field's doc comment across a
 * blank line even though it will not attach a top-level one. Reporting this as
 * misplaced would reject a citation the schema itself honours.
 *
 *  1. Separate a column's citation from the column by a blank line.
 *  2. Assert it still hosts on that column.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaDeclarations keeps the literal column citation and reason at the asserted line.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Explicit expected host,target,reason and source layout establish attachment.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Blank line inside eligible documentation differs from discarded placement.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaBlankLineInsideABlockKeepsTheCitation is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaBlankLineInsideABlockKeepsTheCitation(t *testing.T) {
  declarations, problems := prismaClaimOf(`model Sale {
  /// @evidence docs/spec.md#amounts The amount is stored here.

  price Int
  seller Seller
}
`, prismaClaimModels)
  if len(problems) != 0 {
    t.Fatalf("Prisma attaches this comment, so this rule must too: %v", problems)
  }
  want := "evidence@2 host=column target=docs/spec.md#amounts reason=The amount is stored here."
  if got := prismaDeclarationIndex(declarations); got != want {
    t.Fatalf("declarations:\n%s\nwant:\n%s", got, want)
  }
}
