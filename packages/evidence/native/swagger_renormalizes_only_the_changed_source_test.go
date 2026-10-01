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
 * @evidence contracts/testing.md#behavioral-verification loadSwaggerInventories retains stable.json units and reports only edited volatile.json problems with Node unavailable.
 * @evidence contracts/testing.md#independent-expectations Both entries are seeded before only volatile bytes change.
 * @evidence contracts/testing.md#distinguishing-cases Mixed requests must reuse stable input while changed input crosses fallback.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerRenormalizesOnlyTheChangedSource calls the native loader directly in the shared Go unit process over authored files and cache state. TTSC_NODE_BINARY deliberately names an absent executable, so no Node child, installed decoder, compiler host or native build is created; actual failed lookup keeps the fallback diagnostic observable.
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
