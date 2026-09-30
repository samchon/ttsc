package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a `///` comment hosts a citation for the model, column, or relation
 * it documents.
 *
 * This is the direction that makes a schema answerable: a table that cites
 * nothing has no proof it was needed. The host kind has to come from the parsed
 * population rather than from the text, because a claim's `symbol` selector
 * decides which declarations are in scope, and a relation field read as a
 * column would be judged against the wrong selector.
 *
 *  1. Document a model, a stored column, and a relation field.
 *  2. Assert one declaration per comment, at the line it was written on.
 *  3. Assert each carries the host kind the population says it is.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaClaimOf returns the asserted evidence/exclusion host-line-target-reason index.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Literal comments and explicit expected declaration index specify attachment independently.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Model/member hosts and declaration kinds remain distinct.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaDocCommentHostsACitation is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaDocCommentHostsACitation(t *testing.T) {
  declarations, problems := prismaClaimOf(`/// A sale.
/// @evidence docs/spec.md#pricing The sale concept comes from here.
model Sale {
  /// @evidence docs/spec.md#amounts The amount is stored here.
  price Int

  /// @evidenceExclude docs/spec.md#sellers Ownership is out of scope for now.
  seller Seller
}
`, prismaClaimModels)
  if len(problems) != 0 {
    t.Fatalf("a well-placed citation reports nothing: %v", problems)
  }
  want := strings.Join([]string{
    "evidence@2 host=model target=docs/spec.md#pricing reason=The sale concept comes from here.",
    "evidence@4 host=column target=docs/spec.md#amounts reason=The amount is stored here.",
    "evidenceExclude@7 host=relation target=docs/spec.md#sellers reason=Ownership is out of scope for now.",
  }, "\n")
  if got := prismaDeclarationIndex(declarations); got != want {
    t.Fatalf("declarations:\n%s\nwant:\n%s", got, want)
  }
}
