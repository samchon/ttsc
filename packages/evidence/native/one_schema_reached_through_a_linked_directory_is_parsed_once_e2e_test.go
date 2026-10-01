//go:build e2e

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
 * @evidence contracts/testing.md#behavioral-verification store/ holds the schema and mirror is created as a directory symlink to it; a typescript claim references prisma roots store and mirror. loadPrismaInventories must report no problem and assertBothPopulationsServed must hold (two inventories, shared unit and declaration pointers, smallest-spelling location mirror/main.prisma).
 * @evidence contracts/testing.md#independent-expectations Expectations are literal paths and unit IDs plus the smallest-spelling rule; os.SameFile identity is what the product uses to merge them, so the test pins that merged result rather than computing it independently.
 * @evidence contracts/testing.md#distinguishing-cases A directory-level link (two spellings of one directory); the hard-linked-file spelling and the case-only spelling are in sibling tests. A Windows junction is not created here: os.Symlink is used and the test skips when it fails (L43).
 * @evidence contracts/testing.md#execution-ownership TestOneSchemaReachedThroughALinkedDirectoryIsParsedOnce is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls loadPrismaInventories with a two-rooted prisma graph (Node parser only on a schema-cache miss). It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary On a schema-cache miss, loadPrismaInventories (via normalizePrismaSet) starts a Node child (node -e with the embedded bridge script) that resolves @ttsc/evidence from the fixture root created under packages/evidence/native through Node package self-reference and runs lib/internal/loadPrismaModels.js with a Prisma schema parser, and Go decodes the child's JSON. A hand-built result struct would bypass package resolution, the child process and the JSON transport. The directory link needs a real filesystem that allows symlinks.
 * @evidence contracts/e2e.md#shared-execution One loadPrismaInventories call over one fixture root; at most one Node child (none on a schema-cache hit).
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The directory symlink is created inside the test's own root; prismaBridgeRoot creates a fixture directory under packages/evidence/native via MkdirTemp and registers RemoveAll with t.Cleanup. This path reads the in-process prismaSchemas cache keyed by content digest, so when an earlier test in the same process already parsed identical bytes under the same source spelling the Node child is skipped; whether it launches depends on test order and this test does not force a cold parse. The sibling hard-link test uses identical bytes and the same representative spelling, so whichever runs second hits the cache.
 * @evidence contracts/e2e.md#preserved-coverage The body delegates all assertions to assertBothPopulationsServed; when the symlink cannot be created the test skips (L43) and asserts nothing.
 */
func TestOneSchemaReachedThroughALinkedDirectoryIsParsedOnce(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "store/main.prisma": "/// @evidence https://example.com/sale\nmodel sale {\n  id String @id\n}\n",
  })
  if err := linkDirectory(
    filepath.Join(root, "store"),
    filepath.Join(root, "mirror"),
  ); err != nil {
    t.Skipf("this environment cannot create a directory link: %v", err)
  }
  inventories, problems := loadPrismaInventories(root, twoRootedPrismaGraph(t, root))
  assertBothPopulationsServed(t, inventories, problemMessages(problems))
}
