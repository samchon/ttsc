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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification loadPrismaInventories is exercised with the scenario below; the assertions require the set parsed cleanly and both populations carry the one result.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The other half of the same package layout: pnpm's `node_modules` entries are symbolic links into `node_modules/.pnpm`, and on Windows a junction. The two roots are then two spellings of one directory rather than two names of one file, which no comparison of paths can collapse and which `os.SameFile` answers without knowing a link was involved at all. Run beside the complementary case this is a schema cache hit, because identical bytes under an identical representative spelling compose one digest. That is the coverage worth having; the fan-out is then proved on the cache's hit branch as well as on its miss branch; and the case still measures the whole round trip when it runs alone.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Write one schema and link its directory under a second name. Root one Prisma reference at each. Assert the set parsed cleanly and both populations carry the one result.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestOneSchemaReachedThroughALinkedDirectoryIsParsedOnce runs in tests/test-evidence/go/e2e, selected by the repository Go overlay runner in the shared native package process. prismaBridgeRoot resolves the installed package and loadPrismaInventories can launch its real Node parser.
 * @evidence .agents/skills/contracts/e2e.md#necessary-boundary The Prisma Node bridge resolves the installed @ttsc/evidence loader and pinned parser for this shared-schema layout. A synthetic outcome cannot detect failed package resolution or transport of the schema set. Equivalent warm outcomes can bypass the process, so this entry verifies that one schema reached through a linked directory is parsed once too. This entry does not independently prove a cold bridge launch.
 * @evidence .agents/skills/contracts/e2e.md#shared-execution The overlay batch shares its Go process, installed @ttsc/evidence package and compiled Node loader. Schema outcomes are reused by content digest; different link layouts need separate fixture roots, not separate installations or native builds.
 * @evidence .agents/skills/contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot gives this entry a separate temporary consumer root and registers removal with t.Cleanup. File links and graph inputs stay inside that root. The bounded schema cache may reuse identical bytes and representative paths across roots; this test does not require a cold parse.
 * @evidence .agents/skills/contracts/e2e.md#preserved-coverage TestOneSchemaReachedThroughALinkedDirectoryIsParsedOnce retains its original body, fixture inputs, skips and every assertion after transfer from one_schema_reached_by_two_roots_is_parsed_once_test.go. Its checks require the set parsed cleanly and both populations carry the one result. The synthetic unlocated-model fan-out case remains a unit entry.
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
