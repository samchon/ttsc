package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies a mixed graph re-normalizes only what changed.
 *
 * One spawn serves every source in a cycle, so a single miss pays the process
 * start for all of them unless the request is narrowed. Sending only the misses
 * is what keeps one edited document from costing the others their entries.
 *
 *  1. Remember two documents, then edit one of them.
 *  2. Point `TTSC_NODE_BINARY` at a nonexistent executable and load both.
 *  3. Assert only the edited source is reported.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification loadSwaggerInventories retains stable.json units and reports only edited volatile.json problems with Node unavailable.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Both entries are seeded before only volatile bytes change.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Mixed requests must reuse stable input while changed input crosses fallback.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSwaggerRenormalizesOnlyTheChangedSource is one Go E2E overlay entry at tests/test-evidence/go/e2e/swagger_renormalizes_only_the_changed_source_test.go. The repository runner selects this population separately and overlays it into the native package, preserving access to the actual owner and this function's local case identities.
 * @evidence .agents/skills/contracts/e2e.md#necessary-boundary The actual native inventory loader reaches exec.CommandContext and process startup with an unavailable Node executable. loadSwaggerInventories retains stable.json units and reports only edited volatile.json problems with Node unavailable. This owns missing-executable transport and diagnostic fallback, not installed decoder success; a direct cache lookup would bypass that OS failure connection.
 * @evidence .agents/skills/contracts/e2e.md#shared-execution This case runs in the shared Go E2E process and seeds only the cache state its invalidation distinction requires. It performs no installation, native build or successful Node lifetime; each required miss attempts the real process-start boundary against its deliberately absent executable.
 * @evidence .agents/skills/contracts/e2e.md#state-isolation-and-reuse-validity The preserved body owns its temporary files, cache replacement/reset and TTSC_NODE_BINARY override through existing t.TempDir, t.Cleanup and t.Setenv lifetimes. Tests remain serial in the shared Go process. Failed process startup leaves no running Node child; temporary directories and environment overrides are restored after the case.
 * @evidence .agents/skills/contracts/e2e.md#preserved-coverage TestSwaggerRenormalizesOnlyTheChangedSource retains its original function body, local inputs and every assertion after transfer. loadSwaggerInventories retains stable.json units and reports only edited volatile.json problems with Node unavailable. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
 */
func TestSwaggerRenormalizesOnlyTheChangedSource(t *testing.T) {
  isolateSwaggerCache(t)
  root := writeInventoryFixture(t, "stable.json", swaggerCacheDocument)
  if err := os.WriteFile(filepath.Join(root, "volatile.json"), []byte(swaggerCacheDocument), 0o644); err != nil {
    t.Fatal(err)
  }
  warmSwaggerCache(t, root, "stable.json")

  edited := `{"openapi":"3.1.0","paths":{"/orders":{"get":{}}}}`
  if err := os.WriteFile(filepath.Join(root, "volatile.json"), []byte(edited), 0o644); err != nil {
    t.Fatal(err)
  }
  t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
  inventories, problems := loadSwaggerInventories(
    root,
    swaggerCacheConfig(t, "stable.json", "volatile.json"),
  )
  if len(problems) == 0 {
    t.Fatal("the edited source must be re-normalized")
  }
  for _, problem := range problems {
    if strings.Contains(problem.Message, "stable.json") {
      t.Fatalf("the unchanged source must not be re-normalized, got: %v", problems)
    }
  }
  if len(inventories["stable.json"].Units) != 1 {
    t.Fatalf("the unchanged source must keep its units, got %d", len(inventories["stable.json"].Units))
  }
}
