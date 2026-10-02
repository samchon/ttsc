//go:build e2e

package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies two claims over one shared schema each owe their own reference.
 *
 * The product shape #1262 exists for, at the level an adopter meets it: a
 * package installed under `node_modules` and rooted again at its workspace
 * source is one schema owned by two claims, each answering to its own
 * documents. Before this pull request the whole set was rejected for a model
 * declared twice and neither claim owed anything. Both must now owe exactly
 * their own, and the host they name must be a path that opens; which for a
 * file both claims reached is one of its two spellings rather than each
 * claim's own, and this is where that becomes visible.
 *
 *  1. Hard-link one schema so two rooted claims each own a name for it.
 *  2. Give each claim a different document to answer to.
 *  3. Assert one acknowledgement per claim, each naming its own document.
 * @evidence contracts/testing.md#behavioral-verification One schema (model sale, no citation) is hard-linked at store/ and mirror/; two prisma claims, one rooted at each name, reference docs/installed.md and docs/source.md respectively. runIndexRuleAtRoot must return exactly two messages, one containing "Missing acknowledgement for 'docs/installed.md#installed'" and one containing "Missing acknowledgement for 'docs/source.md#source'", each containing 'on a selected prisma host'.
 * @evidence contracts/testing.md#independent-expectations Each claim owes one acknowledgement of its own document's section, so the expected count is two by construction of the fixture; the messages' host location (mirror vs store) is not asserted.
 * @evidence contracts/testing.md#distinguishing-cases Two claims share one file through two names and answer to different documents, so the obligations must be separate and each must name its own document; a single claim and identical documents are not run.
 * @evidence contracts/testing.md#execution-ownership TestTwoClaimsOverOneSharedSchemaEachOweTheirOwnReference is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls runIndexRuleAtRoot (project rule plus loadPrismaInventories; Node parser only on a schema-cache miss). It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary On a schema-cache miss, loadPrismaInventories (via normalizePrismaSet) starts a Node child (node -e with the embedded bridge script) that resolves @ttsc/evidence from the fixture root created under packages/evidence/native through Node package self-reference and runs lib/internal/loadPrismaModels.js with a Prisma schema parser, and Go decodes the child's JSON. A hand-built result struct would bypass package resolution, the child process and the JSON transport. The hard link needs a real filesystem.
 * @evidence contracts/e2e.md#shared-execution One runIndexRuleAtRoot call covering both claims over one fixture root; at most one Node child (none on a schema-cache hit).
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The hard link and docs live inside the test's own root; prismaBridgeRoot creates a fixture directory under packages/evidence/native via MkdirTemp and registers RemoveAll with t.Cleanup. This path reads the in-process prismaSchemas cache keyed by content digest, so when an earlier test in the same process already parsed identical bytes under the same source spelling the Node child is skipped; whether it launches depends on test order and this test does not force a cold parse.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts exactly two messages, the two document-specific 'Missing acknowledgement' texts and that each mentions 'on a selected prisma host'; the hard-link skip asserts nothing without hard links.
 */
func TestTwoClaimsOverOneSharedSchemaEachOweTheirOwnReference(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "store/main.prisma": "model sale {\n  id String @id\n}\n",
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
    "docs/installed.md": "## Installed {#installed}\n",
    "docs/source.md":    "## Source {#source}\n",
  }, `{"claims":[
    {
      "type":"prisma",
      "root":"store",
      "files":["**/*.prisma"],
      "symbol":"model",
      "reference":{"type":"markdown","files":["docs/installed.md"],"symbol":"h2"}
    },
    {
      "type":"prisma",
      "root":"mirror",
      "files":["**/*.prisma"],
      "symbol":"model",
      "reference":{"type":"markdown","files":["docs/source.md"],"symbol":"h2"}
    }
  ]}`)
  if len(messages) != 2 {
    t.Fatalf(
      "two claims owe one acknowledgement each, got %d:\n%s",
      len(messages),
      strings.Join(messages, "\n"),
    )
  }
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/installed.md#installed'")
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/source.md#source'")
  // One parse, one model, one location, named the same way to both claims.
  for _, message := range messages {
    if !strings.Contains(message, "on a selected prisma host") {
      t.Fatalf("each claim reports its own prisma obligation:\n%s", message)
    }
  }
}
