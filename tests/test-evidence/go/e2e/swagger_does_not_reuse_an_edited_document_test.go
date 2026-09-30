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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification loadSwaggerInventories reports problems after editing a warmed source with Node unavailable.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Changed bytes invalidate the seeded key while missing executable independently fails fallback.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Edited content cannot serve stale units; the count assertion does not pin exact failure text.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSwaggerDoesNotReuseAnEditedDocument is one Go E2E overlay entry at tests/test-evidence/go/e2e/swagger_does_not_reuse_an_edited_document_test.go. The repository runner selects this population separately and overlays it into the native package, preserving access to the actual owner and this function's local case identities.
 * @evidence .agents/skills/contracts/e2e.md#necessary-boundary The actual native inventory loader reaches exec.CommandContext and process startup with an unavailable Node executable. loadSwaggerInventories reports problems after editing a warmed source with Node unavailable. This owns missing-executable transport and diagnostic fallback, not installed decoder success; a direct cache lookup would bypass that OS failure connection.
 * @evidence .agents/skills/contracts/e2e.md#shared-execution This case runs in the shared Go E2E process and seeds only the cache state its invalidation distinction requires. It performs no installation, native build or successful Node lifetime; each required miss attempts the real process-start boundary against its deliberately absent executable.
 * @evidence .agents/skills/contracts/e2e.md#state-isolation-and-reuse-validity The preserved body owns its temporary files, cache replacement/reset and TTSC_NODE_BINARY override through existing t.TempDir, t.Cleanup and t.Setenv lifetimes. Tests remain serial in the shared Go process. Failed process startup leaves no running Node child; temporary directories and environment overrides are restored after the case.
 * @evidence .agents/skills/contracts/e2e.md#preserved-coverage TestSwaggerDoesNotReuseAnEditedDocument retains its original function body, local inputs and every assertion after transfer. loadSwaggerInventories reports problems after editing a warmed source with Node unavailable. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
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
