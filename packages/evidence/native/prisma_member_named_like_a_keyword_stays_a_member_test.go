package evidence

import (
  "testing"
)

/**
 * Verifies a member named after a block keyword is still a member.
 *
 * `model String` is a legal column, and a scan that recognized a block opener
 * by its first word alone would read it as the start of a nested model. Nothing
 * downstream would notice: the real model's remaining members would attach to a
 * block that does not exist.
 *
 *  1. Scan a model with a column named `model` and one named `type`.
 *  2. Assert both are located as members of the enclosing model.
 *
 * @evidence contracts/testing.md#behavioral-verification scanPrismaFile locates keyword-like fields at the asserted lines.
 * @evidence contracts/testing.md#independent-expectations Fixture identifiers occur in field positions with literal expected locations.
 * @evidence contracts/testing.md#distinguishing-cases A member spelling matching a block keyword does not begin another model.
 * @evidence contracts/testing.md#execution-ownership TestPrismaMemberNamedLikeAKeywordStaysAMember is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaMemberNamedLikeAKeywordStaysAMember(t *testing.T) {
  locations := prismaLocationsOf(`model Sale {
  id    String @id
  model String
  type  String
  price Int
}
`)
  assertPrismaLine(t, locations, "Sale.model", 3)
  assertPrismaLine(t, locations, "Sale.type", 4)
  assertPrismaLine(t, locations, "Sale.price", 5)
}
