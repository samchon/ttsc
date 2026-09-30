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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification loadPrismaInventories exercises this case: Verifies the first selected Prisma model activates its claim. The original assertions check assert the selected model keeps the claim active.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A generator-only scaffold is inactive, but adding one model must restore the configured Markdown coverage obligation without any lint-config toggle. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Match one Prisma file containing a selected model. Apply the activation filter to the real loaded inventory. Assert the selected model keeps the claim active. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestFirstSelectedPrismaModelActivatesCoverage is the selectable Go test entry; its local loops and closures remain owned by this entry. It runs the installed Node Prisma loader from the Go test process and belongs to the repository Go E2E overlay.
 * @evidence .agents/skills/contracts/e2e.md#necessary-boundary loadPrismaInventories consumes model inventory through the installed evidence Node loader and pinned Prisma parser. Match one Prisma file containing a selected model. Assert the selected model keeps the claim active. An authored model DTO would bypass parser resolution and model/comment assembly.
 * @evidence .agents/skills/contracts/e2e.md#shared-execution The pnpm-installed evidence package and compiled loader are shared across this Go E2E process; this case does not install dependencies or build a native contributor. requireColdPrismaSchemaFixture removes only the exact schema-content outcome before the first load of each authored schema. That miss starts the real Node parser; subsequent equivalent loads inside the graph evaluation reuse its result. Changed schema inputs require separate parser starts because the synchronous installed bridge consumes one schema set per call; the installed package, compiled loader and Go process are not rebuilt.
 * @evidence .agents/skills/contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot creates a distinct fixture root under the installed suite and registers its removal with t.Cleanup. Each root resolves the same installed package while keeping files separate; the cold-fixture helper removes this schema's one native content-cache entry before its loader call and preserves unrelated entries. These Go tests are serial, so no concurrent case can repopulate the key before the boundary executes. The synchronous loader joins any Node child it starts. t.Cleanup owns removal after normal completion or test failure; abrupt process termination can leave the fixture root.
 * @evidence .agents/skills/contracts/e2e.md#preserved-coverage TestFirstSelectedPrismaModelActivatesCoverage retains every original schema variant and assertion in the Go E2E overlay, with bounded cold-fixture preparation added before the original loader call. Assert the selected model keeps the claim active. Portable graph cases in the native unit population do not claim to prove this installed parser connection.
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
