package evidence

import (
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * Verifies the first selected Prisma model activates its claim.
 *
 * A generator-only scaffold is inactive, but adding one model must restore the
 * configured Markdown coverage obligation without any lint-config toggle.
 *
 *  1. Match one Prisma file containing a selected model.
 *  2. Apply the activation filter to the real loaded inventory.
 *  3. Assert the selected model keeps the claim active.
 *  4. Reuse the loaded model in the whole rule and require its missing Markdown root to fail.
 *
 * @evidence contracts/testing.md#behavioral-verification A cold real schema load must be clean and keep one active model claim. The same loaded schema then runs graphRule.Check with a missing Markdown root, which must produce failed=true and a diagnostic naming missing-prisma-docs rather than silently deactivating the model.
 * @evidence contracts/testing.md#independent-expectations The expectation (a selected model activates its claim; one claim stays) is the activation contract stated in claimIsInactive (a claim is inactive only if it selects no visible unit); the literal `len(active.Claims) != 1` is authored independently of the loader's result.
 * @evidence contracts/testing.md#distinguishing-cases One selected model both survives activation and makes its missing reference fail in the whole rule; the same healthy zero-model decision and TypeScript/Markdown activation contrasts belong to TestPrismaClaimWithOnlyTheBenchmarkScaffoldIsInactive. Hidden units and failed own populations are not tested here.
 * @evidence contracts/testing.md#execution-ownership TestFirstSelectedPrismaModelActivatesCoverage is a Go unit entry of package evidence, run by go test in the package process. It calls the loader functions it names and, through them, the Node parser or normalizer child that the built lib/internal loader provides; it starts no ttsc check, lint sidecar or installed consumer.
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
  result := runIndexRuleAtSeverity(t, root, map[string]string{
    "prisma/schema/model.prisma": "model target {\n  id String @id\n}\n",
  }, `{"claims":[{
    "type":"prisma",
    "files":["prisma/schema/model.prisma"],
    "symbol":"model",
    "reference":{"type":"markdown","root":"missing-prisma-docs","files":["**/*.md"],"symbol":"h2"}
  }]}`, rule.SeverityError)
  if !result.failed {
    t.Errorf("the selected model's missing reference must fail: %v", result.messages)
  }
  assertProblemContains(t, result.messages, "missing-prisma-docs")
}
