package evidence

import (
  "path/filepath"
  "testing"
)

/**
 * Verifies the negative twin: a declared Swagger reference does start the
 * normalizer.
 *
 * This is what makes the complementary case evidence. Under the same unusable binary, a
 * configured Swagger source must fail; proving the guard keys on whether a
 * source was declared, not on the environment happening to be quiet.
 *
 *  1. Point `TTSC_NODE_BINARY` at a nonexistent executable.
 *  2. Load Swagger inventories for a graph that does declare a Swagger source.
 *  3. Assert the normalizer failure is reported against that source.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification loadSwaggerInventories sees a declared local Swagger source while TTSC_NODE_BINARY names an absent executable. Assertions require at least one problem and one retained inventory. They distinguish attempted normalization from returning early, but do not inspect the problem's wording or location.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations This is what makes the complementary case evidence. Under the same unusable binary, a configured Swagger source must fail; proving the guard keys on whether a source was declared, not on the environment happening to be quiet.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases A configured Swagger file under the unusable producer differs from TestSwaggerNormalizerIsNotSpawnedWithoutASwaggerReference, which returns no problem and no inventory under that same absent-binary condition. This failure case retains one inventory for diagnosis.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSwaggerNormalizerIsSpawnedWhenReferenced is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestSwaggerNormalizerIsSpawnedWhenReferenced(t *testing.T) {
  t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
  root := writeInventoryFixture(t, "swagger.json", `{"openapi":"3.1.0","paths":{}}`)
  inventories, problems := loadSwaggerInventories(root, decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{"type":"swagger","file":"swagger.json"}
  }]}`))
  if len(problems) == 0 {
    t.Fatal("expected the unusable normalizer to be reported")
  }
  if len(inventories) != 1 {
    t.Fatalf("expected the configured source to still materialize an inventory, got %d", len(inventories))
  }
}
