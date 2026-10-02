package evidence

import (
  "path/filepath"
  "testing"
)

/**
 * Verifies a graph with no Swagger reference never starts the normalizer.
 *
 * Normalization spawns a Node process and loads the converter, which is a fixed
 * toll per cycle regardless of document size. A
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
 * @evidence contracts/testing.md#behavioral-verification loadSwaggerInventories runs on a configuration whose only reference is Markdown while TTSC_NODE_BINARY names an absent executable; the assertions require zero problems and zero inventories.
 * @evidence contracts/testing.md#independent-expectations With no Swagger reference the authored expectation is an empty result: nothing materialized and nothing reported. Production has two independent early returns (no configured sources, nothing pending), so the absent executable shows no spawn occurred but not which guard returned.
 * @evidence contracts/testing.md#distinguishing-cases The negative arm of a pair: TestSwaggerNormalizerIsSpawnedWhenReferenced runs the same absent executable with a declared Swagger source and must report. Only a Markdown reference is varied here; no mixed Swagger and Markdown configuration is exercised.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerNormalizerIsNotSpawnedWithoutASwaggerReference is a selectable native Go unit entry. It calls loadSwaggerInventories over a one-file Markdown temp fixture in-process; no consumer, Node process, native build or product host is started.
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
