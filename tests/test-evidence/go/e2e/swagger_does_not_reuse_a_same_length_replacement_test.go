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
 * @evidence contracts/testing.md#execution-ownership TestSwaggerDoesNotReuseASameLengthReplacement is one Go E2E overlay entry at tests/test-evidence/go/e2e/swagger_does_not_reuse_a_same_length_replacement_test.go. The repository runner selects this population separately and overlays it into the native package, preserving access to the actual owner and this function's local case identities.
 * @evidence contracts/e2e.md#necessary-boundary The actual native inventory loader reaches exec.CommandContext and process startup with an unavailable Node executable. loadSwaggerInventories reports problems for equal-length changed bytes with unavailable Node. This owns missing-executable transport and diagnostic fallback, not installed decoder success; a direct cache lookup would bypass that OS failure connection.
 * @evidence contracts/e2e.md#shared-execution This case runs in the shared Go E2E process and seeds only the cache state its invalidation distinction requires. It performs no installation, native build or successful Node lifetime; each required miss attempts the real process-start boundary against its deliberately absent executable.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The preserved body owns its temporary files, cache replacement/reset and TTSC_NODE_BINARY override through existing t.TempDir, t.Cleanup and t.Setenv lifetimes. Tests remain serial in the shared Go process. Failed process startup leaves no running Node child; temporary directories and environment overrides are restored after the case.
 * @evidence contracts/e2e.md#preserved-coverage TestSwaggerDoesNotReuseASameLengthReplacement retains its original function body, local inputs and every assertion after transfer. loadSwaggerInventories reports problems for equal-length changed bytes with unavailable Node. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
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
