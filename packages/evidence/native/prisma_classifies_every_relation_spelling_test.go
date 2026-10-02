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
 * @evidence contracts/testing.md#distinguishing-cases Optional relation, list relation, required relation with onDelete and the foreign-key scalar columns are all in one schema; the whole sorted index is compared, so a misclassification of any member changes the result.
 * @evidence contracts/testing.md#execution-ownership TestPrismaClassifiesEveryRelationSpelling is a Go unit entry of package evidence, run by go test in the package process. It calls the loader functions it names and, through them, the Node parser or normalizer child that the built lib/internal loader provides; it starts no ttsc check, lint sidecar or installed consumer.
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
