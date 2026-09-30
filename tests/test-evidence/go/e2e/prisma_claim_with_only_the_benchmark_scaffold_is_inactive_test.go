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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification loadPrismaInventories exercises this case: Verifies the benchmark Prisma scaffold is inactive before its references. The original assertions check assert the real loader leaves the zero-model claim inactive and silent.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations `prisma/schema/main.prisma` is a real matched schema file but its generator and datasource blocks materialize no `model` unit. The fixture reproduces the benchmark scaffold exactly and drives the real Prisma loader so a fake empty inventory cannot make the test pass. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Match the exact model-free benchmark scaffold path and contents. Apply a model claim with an unreadable Markdown reference behind it. Assert the real loader leaves the zero-model claim inactive and silent. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPrismaClaimWithOnlyTheBenchmarkScaffoldIsInactive is the selectable Go test entry; its local loops and closures remain owned by this entry. It runs the installed Node Prisma loader from the Go test process and belongs to the repository Go E2E overlay.
 * @evidence .agents/skills/contracts/e2e.md#necessary-boundary loadPrismaInventories consumes model inventory through the installed evidence Node loader and pinned Prisma parser. Match the exact model-free benchmark scaffold path and contents. Assert the real loader leaves the zero-model claim inactive and silent. An authored model DTO would bypass parser resolution and model/comment assembly.
 * @evidence .agents/skills/contracts/e2e.md#shared-execution The pnpm-installed evidence package and compiled loader are shared across this Go E2E process; this case does not install dependencies or build a native contributor. A content-cache miss starts a Node parser process; an equivalent relative schema path and bytes can reuse its prior outcome even across fixture roots. The original calls remain unchanged, so this entry does not yet force a cold boundary and cannot claim each call launches the parser. The process batching and cold-state guarantee remain unresolved.
 * @evidence .agents/skills/contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot creates a distinct fixture root under the installed suite and registers its removal with t.Cleanup. Each root resolves the same installed package while keeping files separate; the native content cache can still share equivalent schema outcomes across roots. The synchronous loader joins any Node child it starts. t.Cleanup owns removal after normal completion or test failure; abrupt process termination can leave the fixture root.
 * @evidence .agents/skills/contracts/e2e.md#preserved-coverage TestPrismaClaimWithOnlyTheBenchmarkScaffoldIsInactive retains its original function body and assertions in the Go E2E overlay. Assert the real loader leaves the zero-model claim inactive and silent. Portable graph cases in the native unit population do not claim to prove this installed parser connection.
 */
func TestPrismaClaimWithOnlyTheBenchmarkScaffoldIsInactive(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "prisma/schema/main.prisma": emptyPrismaScaffold,
  })
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
