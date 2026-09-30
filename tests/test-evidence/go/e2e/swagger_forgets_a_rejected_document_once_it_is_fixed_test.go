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
 * @evidence contracts/testing.md#execution-ownership TestSwaggerForgetsARejectedDocumentOnceItIsFixed is one Go E2E overlay entry at tests/test-evidence/go/e2e/swagger_forgets_a_rejected_document_once_it_is_fixed_test.go. The repository runner selects this population separately and overlays it into the native package, preserving access to the actual owner and this function's local case identities.
 * @evidence contracts/e2e.md#necessary-boundary The actual native inventory loader reaches exec.CommandContext and process startup with an unavailable Node executable. loadSwaggerInventories reports could-not-run-normalizer after rewriting cached rejected content. This owns missing-executable transport and diagnostic fallback, not installed decoder success; a direct cache lookup would bypass that OS failure connection.
 * @evidence contracts/e2e.md#shared-execution This case runs in the shared Go E2E process and seeds only the cache state its invalidation distinction requires. It performs no installation, native build or successful Node lifetime; each required miss attempts the real process-start boundary against its deliberately absent executable.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The preserved body owns its temporary files, cache replacement/reset and TTSC_NODE_BINARY override through existing t.TempDir, t.Cleanup and t.Setenv lifetimes. Tests remain serial in the shared Go process. Failed process startup leaves no running Node child; temporary directories and environment overrides are restored after the case.
 * @evidence contracts/e2e.md#preserved-coverage TestSwaggerForgetsARejectedDocumentOnceItIsFixed retains its original function body, local inputs and every assertion after transfer. loadSwaggerInventories reports could-not-run-normalizer after rewriting cached rejected content. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
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
