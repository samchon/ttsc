package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies an exclusion in a shared file is placed by every name it is read by.
 *
 * `evidenceExcludeCarriers` confines a claim's exclusions to some of its own
 * files, and a hard link gives one file two names inside that claim; one of
 * which the carrier patterns select and one of which they do not. Deciding the
 * placement per name put the same tag in two places at once and reported
 * whichever name the walk read second, so a tag written exactly where the
 * configuration demands was refused for sitting somewhere it also is. The tag
 * is in a carrier when any name it is read by is one.
 *
 *  1. Hard-link one schema so a single claim selects it under two names.
 *  2. Confine the exclusions to the name the carriers select.
 *  3. Assert the exclusion is accepted and discharges its obligation.
 * @evidence contracts/testing.md#behavioral-verification runIndexRuleAtRoot is exercised with the scenario below; the assertions require the exclusion is accepted and discharges its obligation.
 * @evidence contracts/testing.md#independent-expectations `evidenceExcludeCarriers` confines a claim's exclusions to some of its own files, and a hard link gives one file two names inside that claim; one of which the carrier patterns select and one of which they do not. Deciding the placement per name put the same tag in two places at once and reported whichever name the walk read second, so a tag written exactly where the configuration demands was refused for sitting somewhere it also is. The tag is in a carrier when any name it is read by is one.
 * @evidence contracts/testing.md#distinguishing-cases Hard-link one schema so a single claim selects it under two names. Confine the exclusions to the name the carriers select. Assert the exclusion is accepted and discharges its obligation.
 * @evidence contracts/testing.md#execution-ownership TestAnExclusionInASharedFileIsPlacedByEveryNameThatReadsIt runs in packages/evidence/test/e2e, selected by the repository Go overlay runner in the shared native package process. prismaBridgeRoot resolves the installed package and loadPrismaInventories can launch its real Node parser.
 * @evidence contracts/e2e.md#necessary-boundary The Prisma Node bridge resolves the installed @ttsc/evidence loader and pinned parser for this shared-schema layout. A synthetic outcome cannot detect failed package resolution or transport of the schema set. Equivalent warm outcomes can bypass the process, so this entry verifies that an exclusion in a shared file is placed by every name it is read by. This entry does not independently prove a cold bridge launch.
 * @evidence contracts/e2e.md#shared-execution The overlay batch shares its Go process, installed @ttsc/evidence package and compiled Node loader. Schema outcomes are reused by content digest; different link layouts need separate fixture roots, not separate installations or native builds.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot gives this entry a separate temporary consumer root and registers removal with t.Cleanup. File links and graph inputs stay inside that root. The bounded schema cache may reuse identical bytes and representative paths across roots; this test does not require a cold parse.
 * @evidence contracts/e2e.md#preserved-coverage TestAnExclusionInASharedFileIsPlacedByEveryNameThatReadsIt retains its original body, fixture inputs, skips and every assertion after transfer from one_schema_reached_by_two_roots_is_parsed_once_test.go. Its checks require the exclusion is accepted and discharges its obligation. The synthetic unlocated-model fan-out case remains a unit entry.
 */
func TestAnExclusionInASharedFileIsPlacedByEveryNameThatReadsIt(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "store/main.prisma": "/// @evidenceExclude docs/pricing.md#discounts Discounts are priced outside this table.\nmodel sale {\n  id String @id\n}\n",
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
    "evidenceExcludeCarriers":["mirror/**"],
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  if len(messages) != 0 {
    t.Fatalf(
      "an exclusion inside the carriers owes nothing, got %d:\n%s",
      len(messages),
      strings.Join(messages, "\n"),
    )
  }
}
