package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies a remembered rejection is dropped the moment the document is fixed.
 *
 * The negative twin of the case above, and the one that decides whether caching
 * failures is safe at all. A rejection kept past its bytes would leave an author
 * staring at a diagnostic for a document they have already repaired, with
 * nothing but a restart to clear it — worse than the spawn it saved.
 *
 *  1. Remember a rejection under the bytes on disk.
 *  2. Rewrite the document and load with an unusable normalizer.
 *  3. Assert the normalizer was attempted rather than the rejection replayed.
 *
 * @evidence contracts/testing.md#behavioral-verification loadSwaggerInventories reports could-not-run-normalizer after rewriting cached rejected content.
 * @evidence contracts/testing.md#independent-expectations Repaired bytes change identity while unavailable executable fixes fallback failure.
 * @evidence contracts/testing.md#distinguishing-cases Old unsupported-version rejection cannot survive content repair.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerForgetsARejectedDocumentOnceItIsFixed calls the native loader directly in the shared Go unit process over authored files and cache state. TTSC_NODE_BINARY deliberately names an absent executable, so no Node child, installed decoder, compiler host or native build is created; actual failed lookup keeps the fallback diagnostic observable.
 */
func TestSwaggerForgetsARejectedDocumentOnceItIsFixed(t *testing.T) {
  isolateSwaggerCache(t)
  root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
  swaggerDocuments.store(
    swaggerContentDigest(root, "swagger.json"),
    swaggerDocumentOutcome{Rejected: true, Problem: "unsupported OpenAPI version"},
  )

  repaired := `{"openapi":"3.1.0","paths":{"/members":{"post":{}},"/orders":{"get":{}}}}`
  if err := os.WriteFile(filepath.Join(root, "swagger.json"), []byte(repaired), 0o644); err != nil {
    t.Fatal(err)
  }
  t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
  _, problems := loadSwaggerInventories(root, swaggerCacheConfig(t, "swagger.json"))
  joined := strings.Join(problemMessages(problems), "\n")
  if strings.Contains(joined, "unsupported OpenAPI version") {
    t.Fatalf("a repaired document must not replay its rejection, got: %v", problems)
  }
  if !strings.Contains(joined, "could not run its Swagger normalizer") {
    t.Fatalf("a repaired document must be re-normalized, got: %v", problems)
  }
}
