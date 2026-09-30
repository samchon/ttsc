package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a view hosts a citation exactly as a table does.
 *
 * Prisma returns a view among the datamodel's models — measured, and the
 * opposite of what "view" suggests — so a view is a `model` unit here. A scan
 * that recognized only `model` blocks would leave every citation on a view
 * reported as documenting nothing, on a schema that is entirely valid.
 *
 *  1. Cite from a view and from one of its columns.
 *  2. Assert both host, with the symbols the population gives them.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaClaimOf accepts the asserted model/member citation index for a view.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Literal view fixture and expected index establish model-like hosting.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Views remain eligible while enums have their separate negative case.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaViewHostsACitation is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaViewHostsACitation(t *testing.T) {
  declarations, problems := prismaClaimOf(`/// @evidence docs/spec.md#summary The summary projection comes from here.
view SaleSummary {
  /// @evidence docs/spec.md#totals The total is projected here.
  total Int
}
`, []prismaModel{{
    Name:   "SaleSummary",
    Fields: []prismaField{{Name: "total", Symbol: "column"}},
  }})
  if len(problems) != 0 {
    t.Fatalf("a view is a model unit, so its citations are ordinary: %v", problems)
  }
  want := strings.Join([]string{
    "evidence@1 host=model target=docs/spec.md#summary reason=The summary projection comes from here.",
    "evidence@3 host=column target=docs/spec.md#totals reason=The total is projected here.",
  }, "\n")
  if got := prismaDeclarationIndex(declarations); got != want {
    t.Fatalf("declarations:\n%s\nwant:\n%s", got, want)
  }
}
