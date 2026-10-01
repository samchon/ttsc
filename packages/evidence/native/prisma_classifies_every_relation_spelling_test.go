package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies every relation spelling classifies as a relation.
 *
 * Optional, list, and referential-action forms are the same unit kind written
 * three ways, and each reaches the classifier through different payload fields.
 * A rule that keyed on the presence of `relationFromFields` would drop the list
 * side; one that keyed on `isRequired` would drop the optional side. Both
 * failures shrink a relation population silently.
 *
 *  1. Declare an optional relation, a list relation, and one with `onDelete`.
 *  2. Parse through the real bridge.
 *  3. Assert every relation field is a relation and every scalar a column.
 *
 * @evidence contracts/testing.md#behavioral-verification prismaBridgeUnits matches the whole expected index for optional,list and referential-action relations.
 * @evidence contracts/testing.md#independent-expectations The authored declarations and sorted target-symbol table independently classify scalars/relations.
 * @evidence contracts/testing.md#distinguishing-cases Requiredness and foreign-key-field presence cannot alone classify every relation.
 * @evidence contracts/testing.md#execution-ownership TestPrismaClassifiesEveryRelationSpelling is one Go E2E overlay entry at packages/evidence/test/e2e/prisma_classifies_every_relation_spelling_test.go. The repository runner selects this population separately and overlays it into the native package, preserving access to the actual owner and this function's local case identities.
 * @evidence contracts/e2e.md#necessary-boundary The native Prisma bridge executes Node against the installed evidence package and compiled Prisma loader, then decodes its real response. prismaBridgeUnits matches the whole expected index for optional,list and referential-action relations. A supplied DTO cannot prove package resolution, decoder execution or this payload transport.
 * @evidence contracts/e2e.md#shared-execution All cases reuse the pnpm-installed evidence package and compiled loader in one Go E2E test process. This preserved entry issues its own synchronous Node request for its schema/document inputs; no case installs dependencies or builds a native contributor. Distinct parser inputs justify fresh interpretation, but these per-entry Node lifetimes have not been consolidated into one persistent decoder and are a remaining sharing limitation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The prismaBridgeRoot helper gives this case a private consumer directory under the installed suite and registers t.Cleanup removal. Each synchronous bridge call joins its Node child. The immutable installed loader is shared; loader inventory calls may reuse content-cache outcomes, so this entry does not claim every load is cold. Abrupt process termination may leave the temporary root.
 * @evidence contracts/e2e.md#preserved-coverage TestPrismaClassifiesEveryRelationSpelling retains its original function body, local inputs and every assertion after transfer. prismaBridgeUnits matches the whole expected index for optional,list and referential-action relations. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
 */
func TestPrismaClassifiesEveryRelationSpelling(t *testing.T) {
  want := strings.Join([]string{
    "prisma:Order.id=column",
    "prisma:Order.lines=relation",
    "prisma:Order.owner=relation",
    "prisma:Order.owner_id=column",
    "prisma:Order=model",
    "prisma:User.id=column",
    "prisma:User.orders=relation",
    "prisma:User=model",
    "prisma:line.id=column",
    "prisma:line.order=relation",
    "prisma:line.order_id=column",
    "prisma:line=model",
  }, "\n")
  got := prismaBridgeUnits(t, `datasource db {
  provider = "postgresql"
}

model User {
  id     String  @id @db.Uuid
  orders Order[]
}

model Order {
  id       String  @id @db.Uuid
  owner_id String? @db.Uuid
  owner    User?   @relation(fields: [owner_id], references: [id], onDelete: SetNull)
  lines    line[]
}

model line {
  id       String @id @db.Uuid
  order_id String @db.Uuid
  order    Order  @relation(fields: [order_id], references: [id], onDelete: Cascade)
}
`)
  if got != want {
    t.Fatalf("relation spellings:\n%s\nwant:\n%s", got, want)
  }
}
