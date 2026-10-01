//go:build e2e

package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies an implicit many-to-many relation materializes a relation on each
 * side and no column.
 *
 * This is the shape with no foreign key anywhere: both sides are lists and the
 * join table is Prisma's, not the schema's. A classifier that inferred a column
 * from the field's presence would invent two obligations no citation can ever
 * discharge, on a relation form that is ordinary in real schemas.
 *
 *  1. Declare a list on both sides with no scalar reference.
 *  2. Parse through the real bridge.
 *  3. Assert two models, their ids, and exactly one relation each.
 *
 * @evidence contracts/testing.md#behavioral-verification prismaBridgeUnits matches exactly two models, their id columns and two list relations.
 * @evidence contracts/testing.md#independent-expectations The literal six-line expected index follows explicit declarations with no user-owned join table.
 * @evidence contracts/testing.md#distinguishing-cases Two models related only through list fields on both sides: each side is a relation and no foreign-key column appears; explicit join-table and one-to-many forms are in other tests (every-relation-spelling covers one-to-many).
 * @evidence contracts/testing.md#execution-ownership TestPrismaImplicitManyToManyMaterializesRelationsOnly is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls prismaBridgeUnits (one Node run). It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary prismaBridgeUnits (normalizePrismaSet) starts a Node child (node -e with the embedded bridge script) that resolves @ttsc/evidence from the fixture root created under packages/evidence/native through Node package self-reference and runs lib/internal/loadPrismaModels.js with a Prisma schema parser, and Go decodes the child's JSON. A hand-built result struct would bypass package resolution, the child process and the JSON transport.
 * @evidence contracts/e2e.md#shared-execution prismaBridgeUnits calls normalizePrismaSet once, so the test starts 1 Node child process; no resident bridge or batching is used. The only shared prerequisites are the built @ttsc/evidence package and its compiled lib/internal loaders, which this test neither builds nor installs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot creates 1 fixture directory under packages/evidence/native via MkdirTemp and registers RemoveAll with t.Cleanup; each Node child has exited before its call returns. normalizePrismaSet does not consult the in-process schema cache, so no warm or cold cache state is involved.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts string equality of the whole sorted index against six literal entries.
 */
func TestPrismaImplicitManyToManyMaterializesRelationsOnly(t *testing.T) {
  want := strings.Join([]string{
    "prisma:Category.id=column",
    "prisma:Category.posts=relation",
    "prisma:Category=model",
    "prisma:Post.categories=relation",
    "prisma:Post.id=column",
    "prisma:Post=model",
  }, "\n")
  got := prismaBridgeUnits(t, `datasource db {
  provider = "postgresql"
}

model Post {
  id         String     @id @db.Uuid
  categories Category[]
}

model Category {
  id    String @id @db.Uuid
  posts Post[]
}
`)
  if got != want {
    t.Fatalf("implicit many-to-many units:\n%s\nwant:\n%s", got, want)
  }
}
