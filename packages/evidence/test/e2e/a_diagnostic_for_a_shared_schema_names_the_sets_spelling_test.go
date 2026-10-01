package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies a diagnostic for a shared schema names the one spelling the set has.
 *
 * The guide and the two TSDoc blocks promise this in words: a file both
 * populations reached is located by one of its spellings rather than by each
 * population's own, and it opens the same file either way. The unit's own
 * location is pinned beside the parse; this is the promise as an adopter meets
 * it, in a message, from the claim rooted at the other name.
 *
 *  1. Root two claims at the two names of one hard-linked schema.
 *  2. Write one citation in it whose target nothing materializes.
 *  3. Assert the report locates it at the set's spelling and at no other.
 * @evidence contracts/testing.md#behavioral-verification runIndexRuleAtRoot is exercised with the scenario below; the assertions require the report locates it at the set's spelling and at no other.
 * @evidence contracts/testing.md#independent-expectations The guide and the two TSDoc blocks promise this in words: a file both populations reached is located by one of its spellings rather than by each population's own, and it opens the same file either way. The unit's own location is pinned beside the parse; this is the promise as an adopter meets it, in a message, from the claim rooted at the other name.
 * @evidence contracts/testing.md#distinguishing-cases Root two claims at the two names of one hard-linked schema. Write one citation in it whose target nothing materializes. Assert the report locates it at the set's spelling and at no other.
 * @evidence contracts/testing.md#execution-ownership TestADiagnosticForASharedSchemaNamesTheSetsSpelling runs in packages/evidence/test/e2e, selected by the repository Go overlay runner in the shared native package process. prismaBridgeRoot resolves the installed package and loadPrismaInventories can launch its real Node parser.
 * @evidence contracts/e2e.md#necessary-boundary The Prisma Node bridge resolves the installed @ttsc/evidence loader and pinned parser for this shared-schema layout. A synthetic outcome cannot detect failed package resolution or transport of the schema set. Equivalent warm outcomes can bypass the process, so this entry verifies that a diagnostic for a shared schema names the one spelling the set has. This entry does not independently prove a cold bridge launch.
 * @evidence contracts/e2e.md#shared-execution The overlay batch shares its Go process, installed @ttsc/evidence package and compiled Node loader. Schema outcomes are reused by content digest; different link layouts need separate fixture roots, not separate installations or native builds.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot gives this entry a separate temporary consumer root and registers removal with t.Cleanup. File links and graph inputs stay inside that root. The bounded schema cache may reuse identical bytes and representative paths across roots; this test does not require a cold parse.
 * @evidence contracts/e2e.md#preserved-coverage TestADiagnosticForASharedSchemaNamesTheSetsSpelling retains its original body, fixture inputs, skips and every assertion after transfer from one_schema_reached_by_two_roots_is_parsed_once_test.go. Its checks require the report locates it at the set's spelling and at no other. The synthetic unlocated-model fan-out case remains a unit entry.
 */
func TestADiagnosticForASharedSchemaNamesTheSetsSpelling(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "store/main.prisma": "/// @evidence docs/absent.md#nothing Nothing materializes this target.\nmodel sale {\n  id String @id\n}\n",
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
  }, `{"claims":[
    {
      "type":"prisma",
      "root":"store",
      "files":["**/*.prisma"],
      "symbol":"model",
      "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
    },
    {
      "type":"prisma",
      "root":"mirror",
      "files":["**/*.prisma"],
      "symbol":"model",
      "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
    }
  ]}`)
  assertProblemContains(t, messages, "Unresolved evidence target 'docs/absent.md#nothing' at mirror/main.prisma:1")
  // The claim rooted at the other name reports the same location, because one
  // file has one location and both claims read it from the same parse.
  for _, message := range messages {
    if strings.Contains(message, "store/main.prisma") {
      t.Fatalf("a shared schema is located by the set's spelling alone:\n%s", message)
    }
  }
}
