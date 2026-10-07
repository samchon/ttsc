package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies an edited document is not answered from memory.
 *
 * The negative twin of the case above, and the one that matters: a stale
 * inventory is not a slow build, it is a green build that should have failed —
 * a heading or an operation deleted from a source while every citation to it
 * still reports as satisfied.
 *
 *  1. Remember a document, then rewrite the file with different bytes.
 *  2. Point `TTSC_NODE_BINARY` at a nonexistent executable and load again.
 *  3. Assert the normalizer was attempted, proving the entry was not used.
 *
 * @evidence contracts/testing.md#behavioral-verification loadSwaggerInventories reports problems after editing a warmed source with Node unavailable.
 * @evidence contracts/testing.md#independent-expectations Changed bytes invalidate the seeded key while missing executable independently fails fallback.
 * @evidence contracts/testing.md#distinguishing-cases Edited content cannot serve stale units; the count assertion does not pin exact failure text.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerDoesNotReuseAnEditedDocument calls the native loader directly in the shared Go unit process over authored files and cache state. TTSC_NODE_BINARY deliberately names an absent executable, so no Node child, installed decoder, compiler host or native build is created; actual failed lookup keeps the fallback diagnostic observable.
 */
func TestSwaggerDoesNotReuseAnEditedDocument(t *testing.T) {
  isolateSwaggerCache(t)
  root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
  warmSwaggerCache(t, root, "swagger.json")

  rewritten := `{"openapi":"3.1.0","paths":{"/members":{"post":{}},"/orders":{"get":{}}}}`
  if err := os.WriteFile(filepath.Join(root, "swagger.json"), []byte(rewritten), 0o644); err != nil {
    t.Fatal(err)
  }
  t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
  _, problems := loadSwaggerInventories(root, swaggerCacheConfig(t, "swagger.json"))
  if len(problems) == 0 {
    t.Fatal("an edited document must be re-normalized, not answered from memory")
  }
}
