package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies a schema hard-linked inside one population is cited once, not twice.
 *
 * A hard link is a second directory entry for one file, so a single walk of a
 * single base enumerates both; which is the one shape where a claim's own
 * globs select two spellings of one schema. Parsing it once and serving both
 * entries is what this pull request added, and it made that shape reachable:
 * the parse's declarations are one object filed into both inventories, and a
 * claim that appended each inventory's list saw one citation twice. Every
 * message that follows names a repair the author cannot perform; one tag, on
 * one line, reported as its own duplicate; which is why the correct
 * configuration is what this asserts.
 *
 *  1. Hard-link one schema inside a single claim's base.
 *  2. Cite the reference from the model, correctly and exactly once.
 *  3. Assert the graph closes silently.
 * @evidence contracts/testing.md#behavioral-verification runIndexRuleAtRoot is exercised with the scenario below; the assertions require the graph closes silently.
 * @evidence contracts/testing.md#independent-expectations A hard link is a second directory entry for one file, so a single walk of a single base enumerates both; which is the one shape where a claim's own globs select two spellings of one schema. Parsing it once and serving both entries is what this pull request added, and it made that shape reachable: the parse's declarations are one object filed into both inventories, and a claim that appended each inventory's list saw one citation twice. Every message that follows names a repair the author cannot perform; one tag, on one line, reported as its own duplicate; which is why the correct configuration is what this asserts.
 * @evidence contracts/testing.md#distinguishing-cases Hard-link one schema inside a single claim's base. Cite the reference from the model, correctly and exactly once. Assert the graph closes silently.
 * @evidence contracts/testing.md#execution-ownership TestASchemaHardLinkedInsideOnePopulationIsCitedOnce runs in packages/evidence/test/e2e, selected by the repository Go overlay runner in the shared native package process. prismaBridgeRoot resolves the installed package and loadPrismaInventories can launch its real Node parser.
 * @evidence contracts/e2e.md#necessary-boundary The Prisma Node bridge resolves the installed @ttsc/evidence loader and pinned parser for this shared-schema layout. A synthetic outcome cannot detect failed package resolution or transport of the schema set. Equivalent warm outcomes can bypass the process, so this entry verifies that a schema hard-linked inside one population is cited once, not twice. This entry does not independently prove a cold bridge launch.
 * @evidence contracts/e2e.md#shared-execution The overlay batch shares its Go process, installed @ttsc/evidence package and compiled Node loader. Schema outcomes are reused by content digest; different link layouts need separate fixture roots, not separate installations or native builds.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot gives this entry a separate temporary consumer root and registers removal with t.Cleanup. File links and graph inputs stay inside that root. The bounded schema cache may reuse identical bytes and representative paths across roots; this test does not require a cold parse.
 * @evidence contracts/e2e.md#preserved-coverage TestASchemaHardLinkedInsideOnePopulationIsCitedOnce retains its original body, fixture inputs, skips and every assertion after transfer from one_schema_reached_by_two_roots_is_parsed_once_test.go. Its checks require the graph closes silently. The synthetic unlocated-model fan-out case remains a unit entry.
 */
func TestASchemaHardLinkedInsideOnePopulationIsCitedOnce(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "store/main.prisma": "/// @evidence docs/pricing.md#discounts Sales are priced by the discount table.\nmodel sale {\n  id String @id\n}\n",
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
  messages := runIndexRuleAtRoot(t, root, map[string]string{
    "docs/pricing.md": "## Discounts {#discounts}\n",
  }, `{"claims":[{
    "type":"prisma",
    "files":["**/*.prisma"],
    "symbol":"model",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  if len(messages) != 0 {
    t.Fatalf(
      "one citation on one line owes nothing, got %d:\n%s",
      len(messages),
      strings.Join(messages, "\n"),
    )
  }
}
