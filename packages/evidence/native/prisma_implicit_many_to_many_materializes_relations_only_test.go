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
 * @evidence contracts/testing.md#execution-ownership TestPrismaImplicitManyToManyMaterializesRelationsOnly is a Go unit entry of package evidence, run by go test in the package process. It calls the loader functions it names and, through them, the Node parser or normalizer child that the built lib/internal loader provides; it starts no ttsc check, lint sidecar or installed consumer.
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
