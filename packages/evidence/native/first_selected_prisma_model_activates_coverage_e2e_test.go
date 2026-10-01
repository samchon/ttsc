//go:build e2e

package evidence

import "testing"

/**
 * Verifies the first selected Prisma model activates its claim.
 *
 * A generator-only scaffold is inactive, but adding one model must restore the
 * configured Markdown coverage obligation without any lint-config toggle.
 *
 *  1. Match one Prisma file containing a selected model.
 *  2. Apply the activation filter to the real loaded inventory.
 *  3. Assert the selected model keeps the claim active.
 * @evidence contracts/testing.md#behavioral-verification One model-bearing schema (model target) at prisma/schema/model.prisma is loaded with requireColdPrismaSchemaFixture clearing its cache entry first, so loadPrismaInventories must start the Node parser; it must return no problems (L39) and activeGraphConfig over the loaded inventories must keep the single prisma claim (L48).
 * @evidence contracts/testing.md#independent-expectations The expectation (a selected model activates its claim; one claim stays) is the activation contract stated in claimIsInactive (a claim is inactive only if it selects no visible unit); the literal `len(active.Claims) != 1` is authored independently of the loader's result.
 * @evidence contracts/testing.md#distinguishing-cases Positive case only: one selected model keeps the claim active. The model-free scaffold counterpart (claim becomes inactive) is TestPrismaClaimWithOnlyTheBenchmarkScaffoldIsInactive; no hidden-unit or failed-population case runs here.
 * @evidence contracts/testing.md#execution-ownership TestFirstSelectedPrismaModelActivatesCoverage is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls loadPrismaInventories after requireColdPrismaSchemaFixture, then activeGraphConfig. It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary loadPrismaInventories (via normalizePrismaSet, forced to miss the cache) starts a Node child (node -e with the embedded bridge script) that resolves @ttsc/evidence from the fixture root created under packages/evidence/native through Node package self-reference and runs lib/internal/loadPrismaModels.js with a Prisma schema parser, and Go decodes the child's JSON. A hand-built result struct would bypass package resolution, the child process and the JSON transport.
 * @evidence contracts/e2e.md#shared-execution requireColdPrismaSchemaFixture removes this schema's cache entry, so the single loadPrismaInventories call launches one Node child; there is no second load in the body. The installed link and compiled loaders are shared prerequisites this test does not build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot creates the fixture root under packages/evidence/native with t.Cleanup removal; requireColdPrismaSchemaFixture deletes only this schema's prismaSchemas entry (and its order record), so unrelated cached outcomes are preserved. The Node child has exited before loadPrismaInventories returns.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts a clean load (L39) and that the claim survives activeGraphConfig (L48); the markdown population is passed as an empty map, so no markdown reference is examined.
 */
func TestFirstSelectedPrismaModelActivatesCoverage(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "prisma/schema/model.prisma": "model target {\n  id String @id\n}\n",
  })
  requireColdPrismaSchemaFixture(t, root, "prisma/schema/model.prisma", "model target {\n  id String @id\n}\n")
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"prisma",
    "files":["prisma/schema/**/*.prisma"],
    "symbol":"model",
    "reference":{
      "type":"markdown",
      "files":["docs/**/*.md"],
      "symbol":"h2"
    }
  }]}`)
  inventories, problems := loadPrismaInventories(root, config)
  if len(problems) != 0 {
    t.Fatalf("the Prisma model must load cleanly: %v", problems)
  }
  active := activeGraphConfig(
    config,
    map[string]*artifactInventory{},
    inventories,
    map[string]*artifactInventory{},
  )
  if len(active.Claims) != 1 {
    t.Fatal("the first selected Prisma model must activate its claim")
  }
}
