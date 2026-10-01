//go:build e2e

package evidence

import (
  "testing"
)

/**
 * Verifies a rejected set is reported rather than answered as an empty schema.
 *
 * This is the failure the whole loader is shaped to prevent. A rejection that
 * fell through as zero models would leave every obligation of a Prisma
 * reference vacuously satisfied: the build goes green precisely because the
 * schema could not be read.
 *
 *  1. Load the inventories for an unparseable schema through the real loader.
 *  2. Assert a problem is reported.
 *  3. Assert the inventory carries the same problem rather than silent units.
 *
 * @evidence contracts/testing.md#behavioral-verification loadPrismaInventories reports failure and retains an empty inventory whose problems have wildcard symbols.
 * @evidence contracts/testing.md#independent-expectations The authored unclosed model is invalid; set-wide failures must reach every selected member kind.
 * @evidence contracts/testing.md#distinguishing-cases The reference selects only the model symbol, yet the problem must be filed under "*" so a column-only selector would see it too; a column-only selector is not itself exercised in this body.
 * @evidence contracts/testing.md#execution-ownership TestPrismaLoaderReportsAnUnparseableSchema is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls loadPrismaInventories over a hand-built graphConfig (Node parser or a cached rejection). It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary On a schema-cache miss, loadPrismaInventories (via normalizePrismaSet) starts a Node child (node -e with the embedded bridge script) that resolves @ttsc/evidence from the fixture root created under packages/evidence/native through Node package self-reference and runs lib/internal/loadPrismaModels.js with a Prisma schema parser, and Go decodes the child's JSON. A hand-built result struct would bypass package resolution, the child process and the JSON transport.
 * @evidence contracts/e2e.md#shared-execution One loadPrismaInventories call over one fixture root; at most one Node child (none when this exact rejection is already cached); no sharing beyond the installed link and compiled loaders.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The rejected schema bytes are `model Sale {...` unclosed; a rejection is cached like a success, so a repeat in the same process does not relaunch. prismaBridgeRoot creates a fixture directory under packages/evidence/native via MkdirTemp and registers RemoveAll with t.Cleanup. This path reads the in-process prismaSchemas cache keyed by content digest, so when an earlier test in the same process already parsed identical bytes under the same source spelling the Node child is skipped; whether it launches depends on test order and this test does not force a cold parse.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts a reported problem, an existing inventory with no units, a non-empty inventory problem list, and wildcard symbols on every inventory problem.
 */
func TestPrismaLoaderReportsAnUnparseableSchema(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "prisma/schema.prisma": "model Sale {\n  id String @id\n",
  })
  inventories, problems := loadPrismaInventories(root, anchoredGraph(root, graphConfig{
    Claims: []claimSpec{{
      Type:    artifactTypeScript,
      Files:   mustGlobSet(t, []string{"src/**/*.ts"}),
      Symbols: symbolSet{"type": true},
      References: []referenceSpec{{
        Type:    artifactPrisma,
        Files:   mustGlobSet(t, []string{"prisma/**/*.prisma"}),
        Symbols: symbolSet{"model": true},
      }},
    }},
  }))
  if len(problems) == 0 {
    t.Fatal("an unparseable schema must be reported, never answered as an empty population")
  }
  inventory := inventories["prisma/schema.prisma"]
  if inventory == nil {
    t.Fatal("the configured schema must still have an inventory")
  }
  if len(inventory.Units) != 0 {
    t.Fatal("an unparseable schema materializes no units")
  }
  if len(inventory.Problems) == 0 {
    t.Fatal("the inventory must carry the failure so a selecting reference sees it")
  }
  // A reference reads an inventory problem only when it selects that
  // problem's symbol, so a set-wide failure filed under `model` would look
  // problem-free to a reference selecting only columns — which then blames
  // the selector for materializing nothing, on a schema that could not be
  // read at all.
  for _, problem := range inventory.Problems {
    if problem.Symbol != "*" {
      t.Fatalf("a whole-set failure must reach every selector, got symbol %q", problem.Symbol)
    }
  }
}
