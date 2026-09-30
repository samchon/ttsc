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
 * @evidence contracts/testing.md#behavioral-verification loadPrismaInventories is exercised with the scenario below; the assertions require the set parsed cleanly and both populations carry the one result.
 * @evidence contracts/testing.md#independent-expectations This is the layout a package manager produces. pnpm materializes a package by hard-linking its files out of the content store, so a schema installed twice; as a dependency and as the workspace source of that dependency; is one file on disk under two paths, and a graph that roots a population at each of them names one file twice. Prisma parses a set, and the same model declared twice in that set is rejected as a duplicate, so the configuration failed at the schema instead of at itself. Identity is therefore the file's, not the path's.
 * @evidence contracts/testing.md#distinguishing-cases Write one schema and hard-link it into a second root. Root one Prisma reference at each. Assert the set parsed cleanly and both populations carry the one result.
 * @evidence contracts/testing.md#execution-ownership TestOneSchemaHardLinkedIntoTwoRootsIsParsedOnce runs in tests/test-evidence/go/e2e, selected by the repository Go overlay runner in the shared native package process. prismaBridgeRoot resolves the installed package and loadPrismaInventories can launch its real Node parser.
 * @evidence contracts/e2e.md#necessary-boundary The Prisma Node bridge resolves the installed @ttsc/evidence loader and pinned parser for this shared-schema layout. A synthetic outcome cannot detect failed package resolution or transport of the schema set. Equivalent warm outcomes can bypass the process, so this entry verifies that one schema hard-linked into two roots is parsed once and serves both. This entry does not independently prove a cold bridge launch.
 * @evidence contracts/e2e.md#shared-execution The overlay batch shares its Go process, installed @ttsc/evidence package and compiled Node loader. Schema outcomes are reused by content digest; different link layouts need separate fixture roots, not separate installations or native builds.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot gives this entry a separate temporary consumer root and registers removal with t.Cleanup. File links and graph inputs stay inside that root. The bounded schema cache may reuse identical bytes and representative paths across roots; this test does not require a cold parse.
 * @evidence contracts/e2e.md#preserved-coverage TestOneSchemaHardLinkedIntoTwoRootsIsParsedOnce retains its original body, fixture inputs, skips and every assertion after transfer from one_schema_reached_by_two_roots_is_parsed_once_test.go. Its checks require the set parsed cleanly and both populations carry the one result. The synthetic unlocated-model fan-out case remains a unit entry.
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
