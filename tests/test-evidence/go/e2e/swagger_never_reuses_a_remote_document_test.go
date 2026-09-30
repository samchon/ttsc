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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification swaggerContentDigest declines URL identity and loadSwaggerInventories attempts unavailable Node despite a warmed local outcome.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations HTTPS has no local bytes and the seeded local digest does not establish remote state.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases This rejects local-content reuse for a fresh URL, not separate successful remote-session cache reuse.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSwaggerNeverReusesARemoteDocument is one Go E2E overlay entry at tests/test-evidence/go/e2e/swagger_never_reuses_a_remote_document_test.go. The repository runner selects this population separately and overlays it into the native package, preserving access to the actual owner and this function's local case identities.
 * @evidence .agents/skills/contracts/e2e.md#necessary-boundary The actual native inventory loader reaches exec.CommandContext and process startup with an unavailable Node executable. swaggerContentDigest declines URL identity and loadSwaggerInventories attempts unavailable Node despite a warmed local outcome. This owns missing-executable transport and diagnostic fallback, not installed decoder success; a direct cache lookup would bypass that OS failure connection.
 * @evidence .agents/skills/contracts/e2e.md#shared-execution This case runs in the shared Go E2E process and seeds only the cache state its invalidation distinction requires. It performs no installation, native build or successful Node lifetime; each required miss attempts the real process-start boundary against its deliberately absent executable.
 * @evidence .agents/skills/contracts/e2e.md#state-isolation-and-reuse-validity The preserved body owns its temporary files, cache replacement/reset and TTSC_NODE_BINARY override through existing t.TempDir, t.Cleanup and t.Setenv lifetimes. Tests remain serial in the shared Go process. Failed process startup leaves no running Node child; temporary directories and environment overrides are restored after the case.
 * @evidence .agents/skills/contracts/e2e.md#preserved-coverage TestSwaggerNeverReusesARemoteDocument retains its original function body, local inputs and every assertion after transfer. swaggerContentDigest declines URL identity and loadSwaggerInventories attempts unavailable Node despite a warmed local outcome. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
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
