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
 * @evidence contracts/testing.md#distinguishing-cases Column-only selectors must see parser failure rather than silent empty success.
 * @evidence contracts/testing.md#execution-ownership TestPrismaLoaderReportsAnUnparseableSchema is one Go E2E overlay entry at packages/evidence/test/e2e/prisma_loader_reports_an_unparseable_schema_test.go. The repository runner selects this population separately and overlays it into the native package, preserving access to the actual owner and this function's local case identities.
 * @evidence contracts/e2e.md#necessary-boundary The native Prisma bridge executes Node against the installed evidence package and compiled Prisma loader, then decodes its real response. loadPrismaInventories reports failure and retains an empty inventory whose problems have wildcard symbols. A supplied DTO cannot prove package resolution, decoder execution or this payload transport.
 * @evidence contracts/e2e.md#shared-execution All cases reuse the pnpm-installed evidence package and compiled loader in one Go E2E test process. This preserved entry issues its own synchronous Node request for its schema/document inputs; no case installs dependencies or builds a native contributor. Distinct parser inputs justify fresh interpretation, but these per-entry Node lifetimes have not been consolidated into one persistent decoder and are a remaining sharing limitation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The prismaBridgeRoot helper gives this case a private consumer directory under the installed suite and registers t.Cleanup removal. Each synchronous bridge call joins its Node child. The immutable installed loader is shared; loader inventory calls may reuse content-cache outcomes, so this entry does not claim every load is cold. Abrupt process termination may leave the temporary root.
 * @evidence contracts/e2e.md#preserved-coverage TestPrismaLoaderReportsAnUnparseableSchema retains its original function body, local inputs and every assertion after transfer. loadPrismaInventories reports failure and retains an empty inventory whose problems have wildcard symbols. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
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
