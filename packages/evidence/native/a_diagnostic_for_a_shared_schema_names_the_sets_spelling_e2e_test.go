//go:build e2e

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
 * @evidence contracts/testing.md#behavioral-verification A schema with a citation to the absent target docs/absent.md#nothing is hard-linked at store/ and mirror/; two prisma claims are rooted at the two names. runIndexRuleAtRoot must report "Unresolved evidence target 'docs/absent.md#nothing' at mirror/main.prisma:1" (L62) and no message may mention store/main.prisma (L65-69).
 * @evidence contracts/testing.md#independent-expectations The expected spelling is the lexicographically smallest of the file's spellings, the rule distinctPrismaSources states (sorted spellings, first wins); the expected string is a literal authored from that rule, so this test pins the rule rather than deriving it independently from outside the implementation.
 * @evidence contracts/testing.md#distinguishing-cases The same citation is read from two claims rooted at the two names; the message must use mirror (smaller) and the other claim's name store must never appear. No case with a single name or a different ordering of names is run.
 * @evidence contracts/testing.md#execution-ownership TestADiagnosticForASharedSchemaNamesTheSetsSpelling is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls runIndexRuleAtRoot (project rule plus loadPrismaInventories; Node parser only on a schema-cache miss). It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary On a schema-cache miss, loadPrismaInventories (via normalizePrismaSet) starts a Node child (node -e with the embedded bridge script) that resolves @ttsc/evidence from the fixture root created under packages/evidence/native through Node package self-reference and runs lib/internal/loadPrismaModels.js with a Prisma schema parser, and Go decodes the child's JSON. A hand-built result struct would bypass package resolution, the child process and the JSON transport. The hard link needs a real filesystem.
 * @evidence contracts/e2e.md#shared-execution One runIndexRuleAtRoot call covering two claims over one fixture root; at most one Node child (none on a schema-cache hit); the installed @ttsc/evidence link and compiled loaders are shared prerequisites this test does not build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The hard-linked schema and docs are written inside the test's own root; prismaBridgeRoot creates a fixture directory under packages/evidence/native via MkdirTemp and registers RemoveAll with t.Cleanup. This path reads the in-process prismaSchemas cache keyed by content digest, so when an earlier test in the same process already parsed identical bytes under the same source spelling the Node child is skipped; whether it launches depends on test order and this test does not force a cold parse.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts the unresolved-target message at mirror/main.prisma:1 (L62) and the absence of store/main.prisma from every message (L65-69). The fan-out for a model the scan could not locate is tested by the separate TestAModelTheScanCouldNotLocateReachesEveryPopulationOfTheSet, not here.
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
