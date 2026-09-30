package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies an enum materializes no unit and does not disturb the models beside
 * it.
 *
 * The campaign draws its boundary at models and their members, and an unpinned
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
 * @evidence contracts/testing.md#distinguishing-cases An enum beside a model must not invent an obligation.
 * @evidence contracts/testing.md#execution-ownership TestPrismaEnumMaterializesNoUnit is one Go E2E overlay entry at tests/test-evidence/go/e2e/prisma_enum_materializes_no_unit_test.go. The repository runner selects this population separately and overlays it into the native package, preserving access to the actual owner and this function's local case identities.
 * @evidence contracts/e2e.md#necessary-boundary The native Prisma bridge executes Node against the installed evidence package and compiled Prisma loader, then decodes its real response. prismaBridgeUnits matches the model/member index without an enum unit. A supplied DTO cannot prove package resolution, decoder execution or this payload transport.
 * @evidence contracts/e2e.md#shared-execution All cases reuse the pnpm-installed evidence package and compiled loader in one Go E2E test process. This preserved entry issues its own synchronous Node request for its schema/document inputs; no case installs dependencies or builds a native contributor. Distinct parser inputs justify fresh interpretation, but these per-entry Node lifetimes have not been consolidated into one persistent decoder and are a remaining sharing limitation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The prismaBridgeRoot helper gives this case a private consumer directory under the installed suite and registers t.Cleanup removal. Each synchronous bridge call joins its Node child. The immutable installed loader is shared; loader inventory calls may reuse content-cache outcomes, so this entry does not claim every load is cold. Abrupt process termination may leave the temporary root.
 * @evidence contracts/e2e.md#preserved-coverage TestPrismaEnumMaterializesNoUnit retains its original function body, local inputs and every assertion after transfer. prismaBridgeUnits matches the model/member index without an enum unit. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
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
