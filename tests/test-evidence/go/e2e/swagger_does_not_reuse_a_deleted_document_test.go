package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies a deleted document is not answered from memory.
 *
 * A source that vanished has no bytes to hash, so it cannot hit — and it must
 * still reach the normalizer, because the diagnostic a reader needs is the one
 * naming the missing file, not silence.
 *
 *  1. Remember a document, then delete the file.
 *  2. Point `TTSC_NODE_BINARY` at a nonexistent executable and load again.
 *  3. Assert the normalizer was attempted.
 *
 * @evidence contracts/testing.md#behavioral-verification loadSwaggerInventories reports problems after deleting a warmed document with unavailable Node.
 * @evidence contracts/testing.md#independent-expectations Deliberate deletion removes the previous current-content premise.
 * @evidence contracts/testing.md#distinguishing-cases A vanished file cannot serve cached units; count-only oracle does not identify every failure cause.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerDoesNotReuseADeletedDocument is one Go E2E overlay entry at tests/test-evidence/go/e2e/swagger_does_not_reuse_a_deleted_document_test.go. The repository runner selects this population separately and overlays it into the native package, preserving access to the actual owner and this function's local case identities.
 * @evidence contracts/e2e.md#necessary-boundary The actual native inventory loader reaches exec.CommandContext and process startup with an unavailable Node executable. loadSwaggerInventories reports problems after deleting a warmed document with unavailable Node. This owns missing-executable transport and diagnostic fallback, not installed decoder success; a direct cache lookup would bypass that OS failure connection.
 * @evidence contracts/e2e.md#shared-execution This case runs in the shared Go E2E process and seeds only the cache state its invalidation distinction requires. It performs no installation, native build or successful Node lifetime; each required miss attempts the real process-start boundary against its deliberately absent executable.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The preserved body owns its temporary files, cache replacement/reset and TTSC_NODE_BINARY override through existing t.TempDir, t.Cleanup and t.Setenv lifetimes. Tests remain serial in the shared Go process. Failed process startup leaves no running Node child; temporary directories and environment overrides are restored after the case.
 * @evidence contracts/e2e.md#preserved-coverage TestSwaggerDoesNotReuseADeletedDocument retains its original function body, local inputs and every assertion after transfer. loadSwaggerInventories reports problems after deleting a warmed document with unavailable Node. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
 */
func TestSwaggerDoesNotReuseADeletedDocument(t *testing.T) {
  isolateSwaggerCache(t)
  root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
  warmSwaggerCache(t, root, "swagger.json")

  if err := os.Remove(filepath.Join(root, "swagger.json")); err != nil {
    t.Fatal(err)
  }
  t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
  _, problems := loadSwaggerInventories(root, swaggerCacheConfig(t, "swagger.json"))
  if len(problems) == 0 {
    t.Fatal("a deleted document must still reach the normalizer for its diagnostic")
  }
}
