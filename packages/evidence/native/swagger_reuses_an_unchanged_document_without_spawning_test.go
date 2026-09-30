package evidence

import (
  "path/filepath"
  "testing"
)

/**
 * Verifies an unchanged document is answered from memory without starting the
 * normalizer.
 *
 * This is the whole point of the cache: a resident host re-runs the graph on
 * every rebuild, and re-normalizing a document nobody touched costs a Node
 * process start — roughly a third of a second, paid the same for a three-
 * operation document as for a two-hundred-operation one.
 *
 * The proof is the unusable binary, as elsewhere in this suite: a spawn that
 * happens fails loudly, so silence is evidence that none was attempted rather
 * than evidence that one succeeded quietly.
 *
 *  1. Remember a document under the bytes on disk.
 *  2. Point `TTSC_NODE_BINARY` at a nonexistent executable and load again.
 *  3. Assert the operations materialize with no problem reported.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification loadSwaggerInventories returns the seeded POST unit without problems with Node executable unavailable.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Literal seeded outcome and matching bytes fix the cached unit; unavailable executable exposes fallback attempts.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Unchanged content returns before process startup, without proving parser success.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSwaggerReusesAnUnchangedDocumentWithoutSpawning is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host. The warmed entry returns before process startup; the unavailable executable is a sentinel for an accidental cache miss, not a claimed real parser.
 */
func TestSwaggerReusesAnUnchangedDocumentWithoutSpawning(t *testing.T) {
  isolateSwaggerCache(t)
  root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
  warmSwaggerCache(t, root, "swagger.json")

  t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
  inventories, problems := loadSwaggerInventories(root, swaggerCacheConfig(t, "swagger.json"))
  if len(problems) != 0 {
    t.Fatalf("an unchanged document must not start the normalizer, got: %v", problems)
  }
  targets := swaggerTargets(inventories["swagger.json"])
  if len(targets) != 1 || targets[0] != "swagger:swagger.json:POST:/members" {
    t.Fatalf("cached operations must rebuild the same units, got %v", targets)
  }
}
