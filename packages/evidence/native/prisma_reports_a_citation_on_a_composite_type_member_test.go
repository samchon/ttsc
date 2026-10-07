package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a citation inside a composite type is reported, not hosted.
 *
 * Composite types are outside the unit model: the parser reports them apart
 * from the models the units are built from, so a composite member has no unit
 * to host a citation. The scan still locates a composite block, because it
 * cannot tell that it is unaddressed without reading the parser's answer, and
 * the answer here is that the citation names something that is not a model,
 * column, or relation.
 *
 *  1. Cite from a member of a composite type beside the authored Sale model.
 *  2. Assert one placement problem naming the composite member and no hosted
 *     declaration.
 *  3. Assert a citation above the model in the same schema still hosts.
 *
 * @evidence contracts/testing.md#behavioral-verification prismaClaimOf hosts only the citation above Sale and reports `documents 'Address.street', which is not a model, column, or relation` for the composite member.
 * @evidence contracts/testing.md#independent-expectations The expected key and fragment are literals authored from the unit model: composite types are not models, and the parser returns them apart from `models`, as measured against the installed parser.
 * @evidence contracts/testing.md#distinguishing-cases A composite member and a model in one schema must split: the composite citation is refused with its address and the model citation hosts.
 * @evidence contracts/testing.md#execution-ownership TestPrismaReportsACitationOnACompositeTypeMember is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaReportsACitationOnACompositeTypeMember(t *testing.T) {
  declarations, problems := prismaClaimOf(`type Address {
  /// @evidence docs/spec.md#address Not a unit.
  street String
}

/// @evidence docs/spec.md#pricing Written correctly.
model Sale {
  price Int
  seller Seller
}
`, prismaClaimModels)
  if len(declarations) != 1 || declarations[0].Target != "docs/spec.md#pricing" {
    t.Fatalf("only the citation above the model hosts: %s", prismaDeclarationIndex(declarations))
  }
  if len(problems) != 1 {
    t.Fatalf("expected one problem, got %d:\n%s", len(problems), strings.Join(problems, "\n"))
  }
  if !strings.Contains(problems[0], "prisma/schema.prisma:2") ||
    !strings.Contains(problems[0], "documents 'Address.street', which is not a model, column, or relation") {
    t.Fatalf("the problem must name the line and the composite member: %q", problems[0])
  }
}
