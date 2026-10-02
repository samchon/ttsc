package evidence

import (
  "path/filepath"
  "testing"
)

/**
 * Verifies one schema reached through a linked directory is parsed once too.
 *
 * The other half of the same package layout: pnpm's `node_modules` entries are
 * symbolic links into `node_modules/.pnpm`, and on Windows a junction. The two
 * roots are then two spellings of one directory rather than two names of one
 * file, which no comparison of paths can collapse and which `os.SameFile`
 * answers without knowing a link was involved at all.
 *
 * Run beside the complementary case this is a schema cache hit, because identical bytes
 * under an identical representative spelling compose one digest. That is the
 * coverage worth having; the fan-out is then proved on the cache's hit branch
 * as well as on its miss branch; and the case still measures the whole
 * round trip when it runs alone.
 *
 *  1. Write one schema and link its directory under a second name.
 *  2. Root one Prisma reference at each.
 *  3. Assert the set parsed cleanly and both populations carry the one result.
 *
 * @evidence contracts/testing.md#behavioral-verification store/ holds the schema and mirror is created as a directory symlink to it; a typescript claim references prisma roots store and mirror. loadPrismaInventories must report no problem and assertBothPopulationsServed must hold (two inventories, shared unit and declaration pointers, smallest-spelling location mirror/main.prisma).
 * @evidence contracts/testing.md#independent-expectations Expectations are literal paths and unit IDs plus the smallest-spelling rule; os.SameFile identity is what the product uses to merge them, so the test pins that merged result rather than computing it independently.
 * @evidence contracts/testing.md#distinguishing-cases A directory-level link (two spellings of one directory); the hard-linked-file spelling and the case-only spelling are in sibling tests. A Windows junction is not created here: os.Symlink is used and the test skips when it fails.
 * @evidence contracts/testing.md#execution-ownership TestOneSchemaReachedThroughALinkedDirectoryIsParsedOnce is a Go unit entry of package evidence, run by go test in the package process. It calls the loader functions it names and, through them, the Node parser or normalizer child that the built lib/internal loader provides; it starts no ttsc check, lint sidecar or installed consumer.
 */
func TestOneSchemaReachedThroughALinkedDirectoryIsParsedOnce(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "store/main.prisma": "/// @evidence https://example.com/sale\nmodel sale {\n  id String @id\n}\n",
  })
  if err := linkDirectory(t, 
    filepath.Join(root, "store"),
    filepath.Join(root, "mirror"),
  ); err != nil {
    t.Skipf("this environment cannot create a directory link: %v", err)
  }
  inventories, problems := loadPrismaInventories(root, twoRootedPrismaGraph(t, root))
  assertBothPopulationsServed(t, inventories, problemMessages(problems))
}
