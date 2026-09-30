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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification prismaBridgeUnits matches exactly two models, their id columns and two list relations.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The literal six-line expected index follows explicit declarations with no user-owned join table.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Implicit many-to-many must not invent foreign-key columns.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaImplicitManyToManyMaterializesRelationsOnly is one Go E2E overlay entry at tests/test-evidence/go/e2e/prisma_implicit_many_to_many_materializes_relations_only_test.go. The repository runner selects this population separately and overlays it into the native package, preserving access to the actual owner and this function's local case identities.
 * @evidence .agents/skills/contracts/e2e.md#necessary-boundary The native Prisma bridge executes Node against the installed evidence package and compiled Prisma loader, then decodes its real response. prismaBridgeUnits matches exactly two models, their id columns and two list relations. A supplied DTO cannot prove package resolution, decoder execution or this payload transport.
 * @evidence .agents/skills/contracts/e2e.md#shared-execution All cases reuse the pnpm-installed evidence package and compiled loader in one Go E2E test process. This preserved entry issues its own synchronous Node request for its schema/document inputs; no case installs dependencies or builds a native contributor. Distinct parser inputs justify fresh interpretation, but these per-entry Node lifetimes have not been consolidated into one persistent decoder and are a remaining sharing limitation.
 * @evidence .agents/skills/contracts/e2e.md#state-isolation-and-reuse-validity The prismaBridgeRoot helper gives this case a private consumer directory under the installed suite and registers t.Cleanup removal. Each synchronous bridge call joins its Node child. The immutable installed loader is shared; loader inventory calls may reuse content-cache outcomes, so this entry does not claim every load is cold. Abrupt process termination may leave the temporary root.
 * @evidence .agents/skills/contracts/e2e.md#preserved-coverage TestPrismaImplicitManyToManyMaterializesRelationsOnly retains its original function body, local inputs and every assertion after transfer. prismaBridgeUnits matches exactly two models, their id columns and two list relations. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
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
