package evidence

import (
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies a rejected document is answered from memory without a second spawn.
 *
 * A document the normalizer refuses is one the author is midway through fixing,
 * and while they fix it every unrelated TypeScript save would otherwise pay a
 * fresh process start to be told the same thing again — the state where the
 * cache is least allowed to give up, because it is where the edit loop is
 * tightest.
 *
 *  1. Remember a rejection under the bytes on disk.
 *  2. Point `TTSC_NODE_BINARY` at a nonexistent executable and load again.
 *  3. Assert the original diagnostic is reported, not a normalizer failure.
 *
 * @evidence contracts/testing.md#behavioral-verification loadSwaggerInventories returns original unsupported-version rejection without could-not-run-normalizer with Node unavailable.
 * @evidence contracts/testing.md#independent-expectations The explicitly seeded rejection supplies its literal expected reason.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged rejected bytes reuse their verdict and bypass process startup.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerReusesARejectedDocumentWithoutSpawning is a selectable native Go unit entry. It seeds the swaggerDocuments cache and calls loadSwaggerInventories over a one-file temp fixture; TTSC_NODE_BINARY names an absent executable so an accidental cache miss would surface as a normalizer failure; the test runs in-process and starts no consumer, Node process, native build or product host.
 */
func TestSwaggerReusesARejectedDocumentWithoutSpawning(t *testing.T) {
  isolateSwaggerCache(t)
  root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
  swaggerDocuments.store(
    swaggerContentDigest(root, "swagger.json"),
    swaggerDocumentOutcome{Rejected: true, Problem: "unsupported OpenAPI version"},
  )

  t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
  inventories, problems := loadSwaggerInventories(root, swaggerCacheConfig(t, "swagger.json"))
  joined := strings.Join(problemMessages(problems), "\n")
  if !strings.Contains(joined, "unsupported OpenAPI version") {
    t.Fatalf("the remembered rejection must be reported verbatim, got: %v", problems)
  }
  if strings.Contains(joined, "could not run its Swagger normalizer") {
    t.Fatalf("a remembered rejection must not start the normalizer, got: %v", problems)
  }
  if len(inventories["swagger.json"].Units) != 0 {
    t.Fatal("a rejected document must materialize no evidence units")
  }
}
