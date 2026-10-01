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
 * @evidence contracts/testing.md#execution-ownership TestSwaggerDoesNotReuseADeletedDocument calls the native loader directly in the shared Go unit process over authored files and cache state. TTSC_NODE_BINARY deliberately names an absent executable, so no Node child, installed decoder, compiler host or native build is created; actual failed lookup keeps the fallback diagnostic observable.
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
