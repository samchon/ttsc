package evidence

import (
  "path/filepath"
  "testing"
)

/**
 * Verifies a fresh URL does not reuse a warmed local-content outcome.
 *
 * No successful remote entry is supplied here. This case preserves fallback
 * to the real process-start boundary when local content identity is unavailable.
 *
 *  1. Warm a local-content entry and select a fresh URL.
 *  2. Point Node at an unavailable executable.
 *  3. Assert the URL has no local digest and fallback reports a problem.
 *
 * @evidence contracts/testing.md#behavioral-verification swaggerContentDigest declines URL identity and loadSwaggerInventories attempts unavailable Node despite a warmed local outcome.
 * @evidence contracts/testing.md#independent-expectations HTTPS has no local bytes and the seeded local digest does not establish remote state.
 * @evidence contracts/testing.md#distinguishing-cases This rejects local-content reuse for a fresh URL, not separate successful remote-session cache reuse.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerNeverReusesARemoteDocument calls the native loader directly in the shared Go unit process over authored files and cache state. TTSC_NODE_BINARY deliberately names an absent executable, so no Node child, installed decoder, compiler host or native build is created; actual failed lookup keeps the fallback diagnostic observable.
 */
func TestSwaggerNeverReusesARemoteDocument(t *testing.T) {
  isolateSwaggerCache(t)
  root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
  warmSwaggerCache(t, root, "swagger.json")

  if digest := swaggerContentDigest(root, "https://example.com/swagger.json"); digest != "" {
    t.Fatalf("a remote source must not hash to a cache key, got %q", digest)
  }
  t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
  _, problems := loadSwaggerInventories(
    root,
    swaggerCacheConfig(t, "https://example.com/swagger.json"),
  )
  if len(problems) == 0 {
    t.Fatal("a remote source must always be fetched, never answered from memory")
  }
}
