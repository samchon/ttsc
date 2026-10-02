package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

// TestPrismaLoaderMaterializesALocatedPopulation shares one cold parser answer
// between column/relation classification and the original physical locations.
//
// @evidence contracts/testing.md#behavioral-verification One actual loadPrismaInventories call classifies six original target/symbol pairs and locates five original target/line pairs; every returned unit retains prisma/schema.prisma. Named subtests collect both groups independently.
// @evidence contracts/testing.md#independent-expectations The unchanged prismaBridgeSchema and the literal six-symbol and five-line tables establish expected identities and positions; no observed output supplies an expectation.
// @evidence contracts/testing.md#distinguishing-cases Models, scalar foreign-key columns, forward relations and attribute-free back-references cross the same parser/scanner boundary. A missing inventory fails both dependent groups rather than passing on empty maps.
// @evidence contracts/testing.md#execution-ownership TestPrismaLoaderMaterializesALocatedPopulation is a Go unit entry of package evidence, run by go test in the package process. It calls the loader functions it names and, through them, the Node parser or normalizer child that the built lib/internal loader provides; it starts no ttsc check, lint sidecar or installed consumer.
func TestPrismaLoaderMaterializesALocatedPopulation(t *testing.T) {
  var root string
  var inventories map[string]*artifactInventory
  ready := t.Run("cold_parser_foundation", func(foundation *testing.T) {
    var err error
    root, err = parserBridgeBatchRoot(t, "loadPrismaModels.js")
    if err != nil {
      foundation.Errorf("prepare real parser fixture: %v", err)
      return
    }
    requireColdPrismaSchemaFixture(foundation, root, "prisma/schema.prisma", prismaBridgeSchema)
    var problems graphDiagnostics
    inventories, problems = loadPrismaInventories(root, anchoredGraph(root, graphConfig{
      Claims: []claimSpec{{
        Type: artifactTypeScript,
        Files: mustGlobSet(foundation, []string{"src/**/*.ts"}),
        Symbols: symbolSet{"type": true},
        References: []referenceSpec{{
          Type: artifactPrisma,
          Files: mustGlobSet(foundation, []string{"prisma/**/*.prisma"}),
          Symbols: symbolSet{"model": true, "column": true, "relation": true},
        }},
      }},
    }))
    if len(problems) != 0 {
      foundation.Errorf("a valid schema must load cleanly: %v", problems)
    }
  })
  t.Run("TestPrismaBridgeClassifiesColumnsAndRelations", func(group *testing.T) {
    if !ready {
      group.Error("BLOCKED: cold parser foundation failed")
      return
    }
    inventory := inventories["prisma/schema.prisma"]
    if inventory == nil {
      group.Error("the configured schema must have an inventory")
      return
    }
    index := map[string]string{}
    for _, unit := range inventory.Units {
      index[unit.Target] = unit.Symbol
    }
    for target, symbol := range map[string]string{
      "prisma:Sale": "model",
      "prisma:Sale.price": "column",
      "prisma:Sale.seller_id": "column",
      "prisma:Sale.seller": "relation",
      "prisma:Seller": "model",
      "prisma:Seller.sales": "relation",
    } {
      if index[target] != symbol {
        group.Errorf("%s materialized as %q, want %q", target, index[target], symbol)
      }
    }
  })
  t.Run("TestPrismaLoaderMaterializesALocatedPopulation", func(group *testing.T) {
    if !ready {
      group.Error("BLOCKED: cold parser foundation failed")
      return
    }
    inventory := inventories["prisma/schema.prisma"]
    if inventory == nil {
      group.Error("the configured schema must have an inventory")
      return
    }
    located := map[string]int{}
    for _, unit := range inventory.Units {
      if unit.Path != "prisma/schema.prisma" {
        group.Errorf("%s filed under %q", unit.Target, unit.Path)
      }
      located[unit.Target] = unit.Line
    }
    for target, line := range map[string]int{
      "prisma:Sale": 6,
      "prisma:Sale.price": 8,
      "prisma:Sale.seller": 10,
      "prisma:Seller": 13,
      "prisma:Seller.sales": 15,
    } {
      if located[target] != line {
        group.Errorf("%s located at line %d, want %d", target, located[target], line)
      }
    }
  })
}

// parserBridgeBatchRoot returns a workspace-local root without aborting its
// caller, so preparation failures remain distinguishable from blocked groups.
// The parent test owns cleanup after all consumers, including foundation errors.
//
// Principled implementation: A real enclosing package and built loader remain
// the resolver's authority; an absolute temporary path is a valid createRequire base.
// Clear and simple design: This one fixture lifetime serves both parser batches;
// each test retains its own authored inputs and actual normalization call.
// Prohibited implementation shortcuts: Errors return to the foundation rather
// than synthesizing inventories, skipping assertions or replacing the Node loader.
// Meaningful documentation: The comment states error and cleanup ownership.
// OS-neutral implementation: Native stat, temporary directory, absolute path and
// removal APIs preserve platform path semantics without a shell or case folding.
// Efficient algorithms: Fixed-count path operations prepare one empty fixture.
// Reuse equivalent work: Consumers share this root through their actual producer;
// neither parser output nor a prior fixture is returned by this helper.
// Bound retention and release resources: Parent cleanup removes the exact created
// root after every dependent group; failed cleanup is reported and no handle is retained.
func parserBridgeBatchRoot(t *testing.T, loader string) (string, error) {
  t.Helper()
  if _, err := os.Stat(filepath.Join("..", "lib", "internal", loader)); err != nil {
    return "", err
  }
  created, err := os.MkdirTemp(".", "parser-bridge-")
  if err != nil {
    return "", err
  }
  t.Cleanup(func() {
    if err := os.RemoveAll(created); err != nil {
      t.Errorf("release parser fixture %q: %v", created, err)
    }
  })
  return filepath.Abs(created)
}
