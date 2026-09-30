package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a citation on a declaration this graph does not address is reported.
 *
 * The fixture documents an enum, which is outside the supported model, column
 * and relation hosts. Views are model hosts and have a separate positive case.
 * Dropping such a citation would leave an author believing a table's grounds
 * were recorded when nothing reads them; naming the addressable kinds is what
 * makes the repair obvious.
 *
 *  1. Cite from an enum beside the authored Sale model.
 *  2. Assert one placement problem and no hosted declaration.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaClaimOf hosts nothing and reports supported host kinds for an enum tag.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Literal enum declaration is outside model,column,relation hosts.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Parsing a declaration does not make every kind addressable.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaReportsACitationOnAnUnaddressableDeclaration is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaReportsACitationOnAnUnaddressableDeclaration(t *testing.T) {
  declarations, problems := prismaClaimOf(`/// @evidence docs/spec.md#status The status set comes from here.
enum SaleStatus {
  ACTIVE
}

model Sale {
  price Int
  seller Seller
}
`, prismaClaimModels)
  if len(declarations) != 0 {
    t.Fatalf("an enum hosts nothing: %s", prismaDeclarationIndex(declarations))
  }
  if len(problems) != 1 {
    t.Fatalf("expected one problem, got %d:\n%s", len(problems), strings.Join(problems, "\n"))
  }
  if !strings.Contains(problems[0], "not a model, column, or relation") {
    t.Fatalf("the problem must name the addressable kinds: %q", problems[0])
  }
}
