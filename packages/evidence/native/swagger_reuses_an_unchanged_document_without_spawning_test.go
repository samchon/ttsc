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
 * @evidence contracts/testing.md#behavioral-verification loadSwaggerInventories returns the seeded POST unit without problems with Node executable unavailable.
 * @evidence contracts/testing.md#independent-expectations Literal seeded outcome and matching bytes fix the cached unit; unavailable executable exposes fallback attempts.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged content returns before process startup, without proving parser success.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerReusesAnUnchangedDocumentWithoutSpawning is a selectable native Go unit entry. It warms the swaggerDocuments cache for one temp file and calls loadSwaggerInventories; TTSC_NODE_BINARY names an absent executable so an accidental cache miss would surface as a normalizer failure; the test runs in-process and starts no consumer, Node process, native build or product host.
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
