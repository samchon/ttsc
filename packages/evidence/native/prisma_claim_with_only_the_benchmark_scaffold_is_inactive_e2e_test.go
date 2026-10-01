//go:build e2e

package evidence

import "testing"

/**
 * Verifies the benchmark Prisma scaffold is inactive before its references.
 *
 * `prisma/schema/main.prisma` is a real matched schema file but its generator
 * and datasource blocks materialize no `model` unit. The fixture reproduces
 * the benchmark scaffold exactly and drives the real Prisma loader so a fake
 * empty inventory cannot make the test pass.
 *
 *  1. Match the exact model-free benchmark scaffold path and contents.
 *  2. Apply a model claim with an unreadable Markdown reference behind it.
 *  3. Assert the real loader leaves the zero-model claim inactive and silent.
 * @evidence contracts/testing.md#behavioral-verification A schema with only generator and datasource blocks (emptyPrismaScaffold) at prisma/schema/main.prisma is loaded after its cache entry is cleared, so loadPrismaInventories must start the Node parser and return no problems (L42); activeGraphConfig over the loaded inventories must drop the prisma claim whose markdown reference root is missing (L51).
 * @evidence contracts/testing.md#independent-expectations The expectation (a matched file with no selected model leaves the claim inactive) is the claimIsInactive contract; the fixture is a model-free scaffold of two generators and a datasource, and its equality to any benchmark fixture is not checked.
 * @evidence contracts/testing.md#distinguishing-cases Negative case only: no model means no host, so the claim is inactive; the positive counterpart is TestFirstSelectedPrismaModelActivatesCoverage. The markdown reference root is missing, but activeGraphConfig does not read references, so 'silent' here means only that the Prisma load reported nothing.
 * @evidence contracts/testing.md#execution-ownership TestPrismaClaimWithOnlyTheBenchmarkScaffoldIsInactive is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls loadPrismaInventories after requireColdPrismaSchemaFixture, then activeGraphConfig. It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary loadPrismaInventories (via normalizePrismaSet, forced to miss the cache) starts a Node child (node -e with the embedded bridge script) that resolves @ttsc/evidence from the fixture root created under packages/evidence/native through Node package self-reference and runs lib/internal/loadPrismaModels.js with a Prisma schema parser, and Go decodes the child's JSON. A hand-built result struct would bypass package resolution, the child process and the JSON transport.
 * @evidence contracts/e2e.md#shared-execution requireColdPrismaSchemaFixture clears this schema's cache entry, so the single loadPrismaInventories call launches one Node child; no second load occurs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot creates the fixture root under packages/evidence/native with t.Cleanup removal; requireColdPrismaSchemaFixture deletes only this schema's prismaSchemas entry; the Node child has exited before the load returns.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts a clean load (L42) and an empty claim list after activeGraphConfig (L51); the markdown inventory map is empty, so no markdown diagnostics are evaluated.
 */
func TestPrismaClaimWithOnlyTheBenchmarkScaffoldIsInactive(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "prisma/schema/main.prisma": emptyPrismaScaffold,
  })
  requireColdPrismaSchemaFixture(t, root, "prisma/schema/main.prisma", emptyPrismaScaffold)
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"prisma",
    "files":["prisma/schema/**/*.prisma"],
    "symbol":"model",
    "reference":{
      "type":"markdown",
      "root":"missing-docs",
      "files":["**/*.md"],
      "symbol":"h2"
    }
  }]}`)
  inventories, problems := loadPrismaInventories(root, config)
  if len(problems) != 0 {
    t.Fatalf("the benchmark Prisma scaffold must load cleanly: %v", problems)
  }
  active := activeGraphConfig(
    config,
    map[string]*artifactInventory{},
    inventories,
    map[string]*artifactInventory{},
  )
  if len(active.Claims) != 0 {
    t.Fatal("a matched Prisma scaffold with no selected model must be inactive")
  }
}
