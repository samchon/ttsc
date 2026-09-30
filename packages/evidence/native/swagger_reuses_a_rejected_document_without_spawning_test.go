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
 * @evidence contracts/testing.md#execution-ownership TestSwaggerReusesARejectedDocumentWithoutSpawning is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host. The warmed entry returns before process startup; the unavailable executable is a sentinel for an accidental cache miss, not a claimed real parser.
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
