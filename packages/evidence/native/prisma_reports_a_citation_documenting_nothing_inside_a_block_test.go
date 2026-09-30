package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a comment that documents nothing inside a block is reported too.
 *
 * A run stopping at a block attribute or at the closing brace documents nothing
 * — measured, and a different rule from the blank-line one above. Both leave a
 * citation that reads as if it works.
 *
 *  1. Cite above a block attribute and again above the closing brace.
 *  2. Assert both are reported and neither becomes a declaration.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaDeclarationsFromComments hosts nothing and reports two unattached in-block tags.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Fixture positions have no addressable declaration to document.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Being inside a block alone does not establish member ownership.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaReportsACitationDocumentingNothingInsideABlock is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaReportsACitationDocumentingNothingInsideABlock(t *testing.T) {
  declarations, problems := prismaClaimOf(`model Sale {
  price Int
  seller Seller

  /// @evidence docs/spec.md#a Written above a block attribute.
  @@index([price])

  /// @evidence docs/spec.md#b Written above the closing brace.
}
`, prismaClaimModels)
  if len(declarations) != 0 {
    t.Fatalf("neither position hosts a citation: %s", prismaDeclarationIndex(declarations))
  }
  if len(problems) != 2 {
    t.Fatalf("expected two problems, got %d:\n%s", len(problems), strings.Join(problems, "\n"))
  }
}
