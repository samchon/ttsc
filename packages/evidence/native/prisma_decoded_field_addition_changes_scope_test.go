package evidence

import "testing"

/**
 * Verifies adding a decoded field changes its model scope, not existing units.
 *
 * The source-loader case owns declaration-local digests when the original
 * Sale schema gains currency. This native case owns the next boundary: those
 * decoded records become a parent-linked population whose aggregate review
 * fingerprint must include the new member.
 *
 * @evidence contracts/testing.md#behavioral-verification prismaModelUnits materializes Sale with id/price and then the same records plus currency. The existing model/price digests remain literal values, every after unit has a digest, and newScopeIndex fingerprints must change for Sale while the unchanged price scope remains stable.
 * @evidence contracts/testing.md#independent-expectations The literal DTOs supply unchanged model/id/price digests and one new currency digest. The public subtree contract requires added membership to change the model scope and forbids unrelated edits to a leaf's scope. Equality/inequality expectations preserve TestAnAddedPrismaFieldMovesTheScopeAndNotTheModel's native contribution without deriving expected fingerprints from the hash algorithm; this does not certify its exact encoding.
 * @evidence contracts/testing.md#distinguishing-cases The two populations differ only by a currency column with its own nonempty digest. Model-own and price-own stability contrast with model aggregate invalidation and price aggregate stability. Empty/missing input, changed field content and withdrawal have their separate fingerprint/materialization cases.
 * @evidence contracts/testing.md#execution-ownership TestPrismaDecodedFieldAdditionChangesScope is one native Go unit entry calling prismaModelUnits and newScopeIndex directly with literal in-memory records. It starts no parser bridge, Node child, consumer installation, artifact build or product host. The original bridge case is retained until its source-loader and native surviving cases have actual execution evidence.
 */
func TestPrismaDecodedFieldAdditionChangesScope(t *testing.T) {
  model := prismaModel{
    Name:   "Sale",
    Digest: "model-content",
    Fields: []prismaField{
      {Name: "id", Symbol: "column", Digest: "id-content"},
      {Name: "price", Symbol: "column", Digest: "price-content"},
    },
  }
  before := prismaModelUnits(model)
  model.Fields = append(model.Fields, prismaField{
    Name: "currency", Symbol: "column", Digest: "currency-content",
  })
  after := prismaModelUnits(model)
  if got := prismaUnitIndex(after); got != "prisma:Sale=model\nprisma:Sale.id=column\nprisma:Sale.price=column\nprisma:Sale.currency=column" {
    t.Fatalf("field addition did not produce the complete native population:\n%s", got)
  }
  for _, units := range [][]*evidenceUnit{before, after} {
    for _, unit := range units {
      if unit.Digest == "" {
        t.Fatalf("%s has no content digest", unit.Target)
      }
      switch unit.Target {
      case "prisma:Sale":
        if unit.Digest != "model-content" {
          t.Fatalf("model own digest changed to %q", unit.Digest)
        }
      case "prisma:Sale.price":
        if unit.Digest != "price-content" {
          t.Fatalf("price own digest changed to %q", unit.Digest)
        }
      }
    }
  }
  beforeScopes := newScopeIndex(before)
  afterScopes := newScopeIndex(after)
  if beforeScopes.fingerprint("prisma:Sale") == afterScopes.fingerprint("prisma:Sale") {
    t.Fatal("adding currency left the model's aggregate fingerprint unchanged")
  }
  if beforeScopes.fingerprint("prisma:Sale.price") != afterScopes.fingerprint("prisma:Sale.price") {
    t.Fatal("adding currency changed the unchanged price scope")
  }
}
