package evidence

import (
  "testing"
)

/**
 * Verifies a parsed model carries its own and its members' digests onto their
 * units.
 *
 * The bridge is the only side that understands a Prisma declaration, so the
 * value travels with the identity rather than being rebuilt here. Materializing
 * it onto the unit is what lets `requireReview` compare against the declaration
 * a reviewer read, instead of against the whole schema set's cache key, which
 * every unit shares and which one endpoint's change would expire wholesale.
 *
 * The empty model is the negative twin: a bridge that reports no digest must
 * produce a unit with none, rather than one filled in from something else here.
 *
 *  1. Materialize a model whose parse carried digests.
 *  2. Materialize one whose parse carried none.
 *  3. Assert each unit reports exactly what its declaration carried.
 * @evidence contracts/testing.md#behavioral-verification prismaModelUnits maps literal Sale, price and seller digests into three evidence units; an undigested Bare fixture must leave every output digest empty.
 * @evidence contracts/testing.md#independent-expectations The Go unit constructor must preserve bridge-supplied digests and must not invent absent ones; literal model/column/relation strings are independent field-transfer expectations.
 * @evidence contracts/testing.md#distinguishing-cases Populated model/data/relation units contrast with absent digest input. This entry exercises no Prisma parser or bridge.
 * @evidence contracts/testing.md#execution-ownership TestPrismaUnitsCarryTheirParsedDigests is a selectable native Go unit entry exercising the owning operations named in its behavioral answer in-process. Its direct fixture values and local comparisons require no installed artifact or product process.
 */
func TestPrismaUnitsCarryTheirParsedDigests(t *testing.T) {
  units := prismaModelUnits(prismaModel{
    Name:   "Sale",
    Digest: "model-digest",
    Fields: []prismaField{
      {Name: "price", Symbol: "column", Digest: "price-digest"},
      {Name: "seller", Symbol: "relation", Digest: "seller-digest"},
    },
  })
  want := map[string]string{
    "prisma:Sale":        "model-digest",
    "prisma:Sale.price":  "price-digest",
    "prisma:Sale.seller": "seller-digest",
  }
  if len(units) != len(want) {
    t.Fatalf("materialized %d units, want %d", len(units), len(want))
  }
  for _, unit := range units {
    if unit.Digest != want[unit.Target] {
      t.Fatalf("%s reported digest %q, want %q", unit.Target, unit.Digest, want[unit.Target])
    }
  }
  bare := prismaModelUnits(prismaModel{
    Name:   "Bare",
    Fields: []prismaField{{Name: "id", Symbol: "column"}},
  })
  for _, unit := range bare {
    if unit.Digest != "" {
      t.Fatalf("%s invented digest %q for a parse that carried none", unit.Target, unit.Digest)
    }
  }
}
