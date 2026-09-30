package evidence

import (
  "testing"
)

/**
 * Verifies an ordinary comment without a citation is never reported.
 *
 * The negative twin of the discarded-citation cases. A schema is full of
 * ordinary prose in every comment form, and a rule that reported it would be
 * turned off within a day — taking the citations it does catch with it.
 *
 *  1. Write prose in all three comment forms, in placements that document
 *     nothing.
 *  2. Assert nothing is reported.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaDeclarationsFromComments reports neither problems nor declarations for ordinary prose.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Literal comments contain no evidence declarations.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Unrelated comments neither host citations nor trigger repairs.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaOrdinaryCommentsAreNotReported is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaOrdinaryCommentsAreNotReported(t *testing.T) {
  declarations, problems := prismaClaimOf(`// an ordinary note
/* a block note */

/// detached prose

model Sale {
  price Int

  /// documented, not cited
  seller Seller

  /// prose above the closing brace
}
`, prismaClaimModels)
  if len(problems) != 0 {
    t.Fatalf("prose is not a citation: %v", problems)
  }
  if len(declarations) != 0 {
    t.Fatalf("prose declares nothing: %s", prismaDeclarationIndex(declarations))
  }
}
