//go:build e2e

package evidence

import (
  "testing"
)

/**
 * Verifies the loader materializes a located population end to end.
 *
 * Every piece is exercised alone elsewhere; this is the one case that proves
 * they compose — the walk that finds the files, the bridge that classifies
 * them, and the scan that places them. It is also the only place the fallback
 * would show: a unit whose location never resolved would report line 0 here.
 *
 *  1. Load the inventories for a configured schema through the real loader.
 *  2. Assert the model, its column, and its relation all materialized.
 *  3. Assert each carries the file and line it is written on.
 *
 * @evidence contracts/testing.md#behavioral-verification loadPrismaInventories returns exact file/line locations for the asserted models, column and relations.
 * @evidence contracts/testing.md#independent-expectations Literal schema layout and target-line table independently establish physical positions.
 * @evidence contracts/testing.md#distinguishing-cases The parser's classification (model, column, relation) and the native line scan must compose across both models; Sale.id, Sale.seller_id and Seller.id are present but their lines are not asserted.
 * @evidence contracts/testing.md#execution-ownership TestPrismaLoaderMaterializesALocatedPopulation is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls loadPrismaInventories over a hand-built graphConfig (Node parser only on a schema-cache miss). It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary On a schema-cache miss, loadPrismaInventories (via normalizePrismaSet) starts a Node child (node -e with the embedded bridge script) that resolves @ttsc/evidence from the fixture root created under packages/evidence/native through Node package self-reference and runs lib/internal/loadPrismaModels.js with a Prisma schema parser, and Go decodes the child's JSON. A hand-built result struct would bypass package resolution, the child process and the JSON transport.
 * @evidence contracts/e2e.md#shared-execution One loadPrismaInventories call over one fixture root; at most one Node child (none on a schema-cache hit); prismaBridgeSchema is also parsed by sibling tests, so a hit is possible.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The schema is the shared prismaBridgeSchema constant; prismaBridgeRoot creates a fixture directory under packages/evidence/native via MkdirTemp and registers RemoveAll with t.Cleanup. This path reads the in-process prismaSchemas cache keyed by content digest, so when an earlier test in the same process already parsed identical bytes under the same source spelling the Node child is skipped; whether it launches depends on test order and this test does not force a cold parse.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts a clean load, the presence of the schema's inventory, the file path of every unit and the five target/line pairs.
 */
func TestPrismaLoaderMaterializesALocatedPopulation(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "prisma/schema.prisma": prismaBridgeSchema,
  })
  inventories, problems := loadPrismaInventories(root, anchoredGraph(root, graphConfig{
    Claims: []claimSpec{{
      Type:    artifactTypeScript,
      Files:   mustGlobSet(t, []string{"src/**/*.ts"}),
      Symbols: symbolSet{"type": true},
      References: []referenceSpec{{
        Type:    artifactPrisma,
        Files:   mustGlobSet(t, []string{"prisma/**/*.prisma"}),
        Symbols: symbolSet{"model": true, "column": true, "relation": true},
      }},
    }},
  }))
  if len(problems) != 0 {
    t.Fatalf("a valid schema must load cleanly: %v", problems)
  }
  inventory := inventories["prisma/schema.prisma"]
  if inventory == nil {
    t.Fatal("the configured schema must have an inventory")
  }
  located := map[string]int{}
  for _, unit := range inventory.Units {
    if unit.Path != "prisma/schema.prisma" {
      t.Fatalf("%s filed under %q", unit.Target, unit.Path)
    }
    located[unit.Target] = unit.Line
  }
  for target, line := range map[string]int{
    "prisma:Sale":         6,
    "prisma:Sale.price":   8,
    "prisma:Sale.seller":  10,
    "prisma:Seller":       13,
    "prisma:Seller.sales": 15,
  } {
    if located[target] != line {
      t.Fatalf("%s located at line %d, want %d", target, located[target], line)
    }
  }
}
