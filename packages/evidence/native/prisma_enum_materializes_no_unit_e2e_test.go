//go:build e2e

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
 * @evidence contracts/testing.md#execution-ownership TestPrismaEnumMaterializesNoUnit is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls prismaBridgeUnits (one Node run). It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary prismaBridgeUnits (normalizePrismaSet) starts a Node child (node -e with the embedded bridge script) that resolves @ttsc/evidence from the fixture root created under packages/evidence/native through Node package self-reference and runs lib/internal/loadPrismaModels.js with a Prisma schema parser, and Go decodes the child's JSON. A hand-built result struct would bypass package resolution, the child process and the JSON transport.
 * @evidence contracts/e2e.md#shared-execution prismaBridgeUnits calls normalizePrismaSet once, so the test starts 1 Node child process; no resident bridge or batching is used. The only shared prerequisites are the built @ttsc/evidence package and its compiled lib/internal loaders, which this test neither builds nor installs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot creates 1 fixture directory under packages/evidence/native via MkdirTemp and registers RemoveAll with t.Cleanup; each Node child has exited before its call returns. normalizePrismaSet does not consult the in-process schema cache, so no warm or cold cache state is involved.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts string equality of the whole sorted index against five literal entries.
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
