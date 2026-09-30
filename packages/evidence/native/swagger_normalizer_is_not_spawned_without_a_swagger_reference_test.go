package evidence

import (
  "path/filepath"
  "testing"
)

/**
 * Verifies a graph with no Swagger reference never starts the normalizer.
 *
 * Normalization spawns a Node process and loads the converter, which is a fixed
 * toll of roughly a third of a second per cycle regardless of document size. A
 * project that declared no Swagger must not pay it, and the guard that prevents
 * it is one early return away from being lost.
 *
 * The assertion works by pointing the bridge at a binary that cannot exist: a
 * spawn that happens fails loudly, and silence therefore proves no spawn was
 * attempted rather than merely that one succeeded.
 *
 *  1. Point `TTSC_NODE_BINARY` at a nonexistent executable.
 *  2. Load Swagger inventories for a graph referencing only Markdown.
 *  3. Assert no problem is reported.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification loadSwaggerInventories is exercised with the scenario below; the assertions require no problem is reported.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Normalization spawns a Node process and loads the converter, which is a fixed toll of roughly a third of a second per cycle regardless of document size. A project that declared no Swagger must not pay it, and the guard that prevents it is one early return away from being lost. The assertion works by pointing the bridge at a binary that cannot exist: a spawn that happens fails loudly, and silence therefore proves no spawn was attempted rather than merely that one succeeded.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Point `TTSC_NODE_BINARY` at a nonexistent executable. Load Swagger inventories for a graph referencing only Markdown. Assert no problem is reported.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSwaggerNormalizerIsNotSpawnedWithoutASwaggerReference is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestSwaggerNormalizerIsNotSpawnedWithoutASwaggerReference(t *testing.T) {
  t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
  root := writeInventoryFixture(t, "docs/spec.md", "## Pricing {#pricing}\n")
  inventories, problems := loadSwaggerInventories(root, decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`))
  if len(problems) != 0 {
    t.Fatalf("expected no normalizer to run, got: %v", problems)
  }
  if len(inventories) != 0 {
    t.Fatalf("expected no Swagger inventory, got %d", len(inventories))
  }
}
