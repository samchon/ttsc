package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies a replacement of exactly the same length is not answered from
 * memory.
 *
 * This is the hole a size-and-timestamp key leaves open, and the reason the key
 * is the content itself. An operation renamed to another of equal length, saved
 * inside one filesystem timestamp tick, changes what the document means while
 * changing neither its size nor, on a coarse clock, its modification time.
 *
 *  1. Remember a document, then rewrite it with different bytes of equal length.
 *  2. Point `TTSC_NODE_BINARY` at a nonexistent executable and load again.
 *  3. Assert the normalizer was attempted.
 *
 * @evidence contracts/testing.md#behavioral-verification loadSwaggerInventories reports problems for equal-length changed bytes with unavailable Node.
 * @evidence contracts/testing.md#independent-expectations Fixture length equality is explicitly checked before fallback.
 * @evidence contracts/testing.md#distinguishing-cases Content rather than size controls reuse; no successful normalizer is claimed.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerDoesNotReuseASameLengthReplacement calls the native loader directly in the shared Go unit process over authored files and cache state. TTSC_NODE_BINARY deliberately names an absent executable, so no Node child, installed decoder, compiler host or native build is created; actual failed lookup keeps the fallback diagnostic observable.
 */
func TestSwaggerDoesNotReuseASameLengthReplacement(t *testing.T) {
  isolateSwaggerCache(t)
  root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
  warmSwaggerCache(t, root, "swagger.json")

  replacement := `{"openapi":"3.1.0","paths":{"/members":{"put!":{}}}}`
  if len(replacement) != len(swaggerCacheDocument) {
    t.Fatalf("fixture must be the same length: %d vs %d", len(replacement), len(swaggerCacheDocument))
  }
  if err := os.WriteFile(filepath.Join(root, "swagger.json"), []byte(replacement), 0o644); err != nil {
    t.Fatal(err)
  }
  t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
  _, problems := loadSwaggerInventories(root, swaggerCacheConfig(t, "swagger.json"))
  if len(problems) == 0 {
    t.Fatal("a same-length replacement must be re-normalized")
  }
}
