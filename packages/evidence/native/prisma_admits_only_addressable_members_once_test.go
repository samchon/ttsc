package evidence

import (
  "testing"
)

/**
 * Verifies materialization admits only the two member kinds this graph
 * addresses, and never the same address twice.
 *
 * Both guards protect the coverage denominator from the process boundary. A
 * member kind this graph does not know would become a unit whose symbol no
 * selector can ever select — an obligation that cannot be acknowledged and
 * therefore fails forever — while a repeated name would count one field as two
 * obligations, the second of which no citation can discharge separately.
 *
 *  1. Materialize a model carrying an unknown member kind and a repeated name.
 *  2. Assert the unknown kind contributes nothing.
 *  3. Assert the repeat collapses to the first occurrence.
 *
 * @evidence contracts/testing.md#behavioral-verification prismaModelUnits emits only the expected Sale model and price column from malformed/duplicate inputs.
 * @evidence contracts/testing.md#independent-expectations The literal expected index excludes the unknown index symbol and repeated price identity.
 * @evidence contracts/testing.md#distinguishing-cases Valid members survive while bad/repeated identities do not multiply units.
 * @evidence contracts/testing.md#execution-ownership TestPrismaAdmitsOnlyAddressableMembersOnce is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaAdmitsOnlyAddressableMembersOnce(t *testing.T) {
  units := prismaModelUnits(prismaModel{
    Name: "Sale",
    Fields: []prismaField{
      {Name: "price", Symbol: "column"},
      {Name: "sequence", Symbol: "index"},
      {Name: "price", Symbol: "relation"},
    },
  })
  want := "prisma:Sale=model\nprisma:Sale.price=column"
  if got := prismaUnitIndex(units); got != want {
    t.Fatalf("materialized units:\n%s\nwant:\n%s", got, want)
  }
}
