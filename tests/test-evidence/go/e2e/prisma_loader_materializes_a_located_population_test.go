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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification loadPrismaInventories returns exact file/line locations for the asserted models, column and relations.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Literal schema layout and target-line table independently establish physical positions.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Bridge classification and native scanning must compose across member kinds.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaLoaderMaterializesALocatedPopulation is one Go E2E overlay entry at tests/test-evidence/go/e2e/prisma_loader_materializes_a_located_population_test.go. The repository runner selects this population separately and overlays it into the native package, preserving access to the actual owner and this function's local case identities.
 * @evidence .agents/skills/contracts/e2e.md#necessary-boundary The native Prisma bridge executes Node against the installed evidence package and compiled Prisma loader, then decodes its real response. loadPrismaInventories returns exact file/line locations for the asserted models, column and relations. A supplied DTO cannot prove package resolution, decoder execution or this payload transport.
 * @evidence .agents/skills/contracts/e2e.md#shared-execution All cases reuse the pnpm-installed evidence package and compiled loader in one Go E2E test process. This preserved entry issues its own synchronous Node request for its schema/document inputs; no case installs dependencies or builds a native contributor. Distinct parser inputs justify fresh interpretation, but these per-entry Node lifetimes have not been consolidated into one persistent decoder and are a remaining sharing limitation.
 * @evidence .agents/skills/contracts/e2e.md#state-isolation-and-reuse-validity The prismaBridgeRoot helper gives this case a private consumer directory under the installed suite and registers t.Cleanup removal. Each synchronous bridge call joins its Node child. The immutable installed loader is shared; loader inventory calls may reuse content-cache outcomes, so this entry does not claim every load is cold. Abrupt process termination may leave the temporary root.
 * @evidence .agents/skills/contracts/e2e.md#preserved-coverage TestPrismaLoaderMaterializesALocatedPopulation retains its original function body, local inputs and every assertion after transfer. loadPrismaInventories returns exact file/line locations for the asserted models, column and relations. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
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
