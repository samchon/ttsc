package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies one schema hard-linked into two roots is parsed once and serves both.
 *
 * This is the layout a package manager produces. pnpm materializes a package by
 * hard-linking its files out of the content store, so a schema installed twice
 *; as a dependency and as the workspace source of that dependency; is one
 * file on disk under two paths, and a graph that roots a population at each of
 * them names one file twice. Prisma parses a set, and the same model declared
 * twice in that set is rejected as a duplicate, so the configuration failed at
 * the schema instead of at itself. Identity is therefore the file's, not the
 * path's.
 *
 *  1. Write one schema and hard-link it into a second root.
 *  2. Root one Prisma reference at each.
 *  3. Assert the set parsed cleanly and both populations carry the one result.
 *
 * @evidence contracts/testing.md#behavioral-verification One schema (model sale with a citation) is hard-linked as store/main.prisma and mirror/main.prisma, and a typescript claim references prisma roots store and mirror. loadPrismaInventories must report no problem; assertBothPopulationsServed then requires two inventories (mirror/..., store/...), neither failed nor with problems, each with units prisma:sale and prisma:sale.id, the first unit pointer-identical across both, located at mirror/main.prisma, and one pointer-identical declaration in each.
 * @evidence contracts/testing.md#independent-expectations The expectations are literal paths, unit IDs and the 'smallest spelling' rule from distinctPrismaSources; a duplicate-model rejection by the parser (what the bug produced) would surface as a reported problem, so one clean parse is observed only indirectly (no process count is taken).
 * @evidence contracts/testing.md#distinguishing-cases Hard-linked names (two directory entries of one file) via two roots; the linked-directory spelling is in the sibling test and the case-only spelling in TestTwoRootsDifferingOnlyInCaseReachOneSchema; two distinct files are in TestTwoRootsNamingTwoSchemasKeepBothInTheSet.
 * @evidence contracts/testing.md#execution-ownership TestOneSchemaHardLinkedIntoTwoRootsIsParsedOnce is a Go unit entry of package evidence, run by go test in the package process. It calls the loader functions it names and, through them, the Node parser or normalizer child that the built lib/internal loader provides; it starts no ttsc check, lint sidecar or installed consumer.
 */
func TestOneSchemaHardLinkedIntoTwoRootsIsParsedOnce(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "store/main.prisma": "/// @evidence https://example.com/sale\nmodel sale {\n  id String @id\n}\n",
  })
  if err := os.MkdirAll(filepath.Join(root, "mirror"), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.Link(
    filepath.Join(root, "store", "main.prisma"),
    filepath.Join(root, "mirror", "main.prisma"),
  ); err != nil {
    t.Skipf("this filesystem does not support hard links: %v", err)
  }
  inventories, problems := loadPrismaInventories(root, twoRootedPrismaGraph(t, root))
  assertBothPopulationsServed(t, inventories, problemMessages(problems))
}
