//go:build e2e

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
 * @evidence contracts/testing.md#execution-ownership TestPrismaClassifiesEveryRelationSpelling is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls prismaBridgeUnits (one Node run through normalizePrismaSet and prismaModelUnits). It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary prismaBridgeUnits (normalizePrismaSet) starts a Node child (node -e with the embedded bridge script) that resolves @ttsc/evidence from the fixture root created under packages/evidence/native through Node package self-reference and runs lib/internal/loadPrismaModels.js with a Prisma schema parser, and Go decodes the child's JSON. A hand-built result struct would bypass package resolution, the child process and the JSON transport.
 * @evidence contracts/e2e.md#shared-execution prismaBridgeUnits calls normalizePrismaSet once, so the test starts 1 Node child process; no resident bridge or batching is used. The only shared prerequisites are the built @ttsc/evidence package and its compiled lib/internal loaders, which this test neither builds nor installs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot creates 1 fixture directory under packages/evidence/native via MkdirTemp and registers RemoveAll with t.Cleanup; each Node child has exited before its call returns. normalizePrismaSet does not consult the in-process schema cache, so no warm or cold cache state is involved.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts string equality of the whole sorted target=symbol index (12 entries) against the literal expectation.
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
