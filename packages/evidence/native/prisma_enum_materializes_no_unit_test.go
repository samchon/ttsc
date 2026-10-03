package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies an enum materializes no unit and does not disturb the models beside
 * it.
 *
 * The graph draws its boundary at models and their members, and an unpinned
 * boundary is one a later change crosses without noticing. The risk is not that
 * an enum becomes citable — it is that its values are read as members of
 * whichever model was declared before it, which would put obligations on a
 * table that never declared them.
 *
 *  1. Declare an enum between two models and use it as a column type.
 *  2. Parse through the real bridge.
 *  3. Assert only the models and their own members materialize.
 *
 * @evidence contracts/testing.md#behavioral-verification prismaBridgeUnits matches the model/member index without an enum unit.
 * @evidence contracts/testing.md#independent-expectations The fixture declares an enum, outside supported addressable kinds.
 * @evidence contracts/testing.md#distinguishing-cases An enum declared between two models (with a doc comment) and used as a column type: no enum or enum-value unit appears and neighbors keep only their own members; composite types and datasource members are not in this schema.
 * @evidence contracts/testing.md#execution-ownership TestPrismaEnumMaterializesNoUnit is a Go unit entry of package evidence, run by go test in the package process. It calls the loader functions it names and, through them, the Node parser or normalizer child that the built lib/internal loader provides; it starts no ttsc check, lint sidecar or installed consumer.
 */
func TestPrismaEnumMaterializesNoUnit(t *testing.T) {
  want := strings.Join([]string{
    "prisma:Sale.id=column",
    "prisma:Sale.status=column",
    "prisma:Sale=model",
    "prisma:Seller.id=column",
    "prisma:Seller=model",
  }, "\n")
  got := prismaBridgeUnits(t, `datasource db {
  provider = "postgresql"
}

model Sale {
  id     String     @id @db.Uuid
  status SaleStatus
}

/// The set of sale states.
enum SaleStatus {
  ACTIVE
  CLOSED
}

model Seller {
  id String @id @db.Uuid
}
`)
  if got != want {
    t.Fatalf("units beside an enum:\n%s\nwant:\n%s", got, want)
  }
}
