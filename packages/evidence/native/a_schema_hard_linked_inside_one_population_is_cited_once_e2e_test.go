//go:build e2e

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
 * globs select two spellings of one schema. The schema is parsed once and both
 * entries are served from that parse: its declarations are one object filed into
 * both inventories, so a claim that appended each inventory's list would see one
 * citation twice and report a tag, on one line, as its own duplicate, naming a
 * repair the author cannot perform. The correct configuration is what this
 * asserts.
 *
 *  1. Hard-link one schema inside a single claim's base.
 *  2. Cite the reference from the model, correctly and exactly once.
 *  3. Assert the graph closes silently.
 * @evidence contracts/testing.md#behavioral-verification One schema with `/// @evidence docs/pricing.md#discounts ...` above model sale is hard-linked as store/main.prisma and mirror/main.prisma inside one prisma claim whose glob selects both; against markdown docs/pricing.md, runIndexRuleAtRoot must return no messages, i.e. the single citation is not counted twice and the obligation is discharged.
 * @evidence contracts/testing.md#independent-expectations The correct configuration (one tag, one line, correct target) is authored so that a faithful implementation owes nothing; the expected result is silence by construction of the fixture, not an externally computed output.
 * @evidence contracts/testing.md#distinguishing-cases Only the positive layout (two names of one file inside one claim base) is run; the duplicated-citation failure it guards against is observed as extra messages that this body would then fail on, but no deliberately failing configuration is run.
 * @evidence contracts/testing.md#execution-ownership TestASchemaHardLinkedInsideOnePopulationIsCitedOnce is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls runIndexRuleAtRoot (project rule plus loadPrismaInventories; Node parser only on a schema-cache miss). It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary On a schema-cache miss, loadPrismaInventories (via normalizePrismaSet) starts a Node child (node -e with the embedded bridge script) that resolves @ttsc/evidence from the fixture root created under packages/evidence/native through Node package self-reference and runs lib/internal/loadPrismaModels.js with a Prisma schema parser, and Go decodes the child's JSON. A hand-built result struct would bypass package resolution, the child process and the JSON transport. The hard link needs a real filesystem.
 * @evidence contracts/e2e.md#shared-execution One runIndexRuleAtRoot call over one fixture root; at most one Node child (none on a schema-cache hit); shared prerequisites are the installed link and compiled loaders, not built here.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The hard-linked schema lives inside the test's own root; prismaBridgeRoot creates a fixture directory under packages/evidence/native via MkdirTemp and registers RemoveAll with t.Cleanup. This path reads the in-process prismaSchemas cache keyed by content digest, so when an earlier test in the same process already parsed identical bytes under the same source spelling the Node child is skipped; whether it launches depends on test order and this test does not force a cold parse.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts a single condition: no message is reported for the hard-linked schema; the hard-link skip leaves nothing asserted on filesystems without hard links.
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
