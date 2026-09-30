package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies two sources holding identical bytes share one entry, each keeping
 * its own unit identity.
 *
 * What is remembered is a property of the document, not of where it was found,
 * so the key is the content alone. Units are rebuilt per source because a unit
 * carries its source in its identity — sharing the entry must not make one
 * source answer under the other's name.
 *
 *  1. Remember one document, then declare a second file with identical bytes.
 *  2. Point `TTSC_NODE_BINARY` at a nonexistent executable and load both.
 *  3. Assert both hit and each unit names its own source.
 *
 * @evidence contracts/testing.md#behavioral-verification loadSwaggerInventories returns both equal-byte documents with separate source-qualified POST IDs and no problems.
 * @evidence contracts/testing.md#independent-expectations Two literal paths share exact bytes but independently expected IDs include their own source names.
 * @evidence contracts/testing.md#distinguishing-cases Sharing outcomes must not collapse source identities.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerSharesOneEntryAcrossIdenticalDocuments is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host. The warmed entry returns before process startup; the unavailable executable is a sentinel for an accidental cache miss, not a claimed real parser.
 */
func TestSwaggerSharesOneEntryAcrossIdenticalDocuments(t *testing.T) {
  isolateSwaggerCache(t)
  root := writeInventoryFixture(t, "first.json", swaggerCacheDocument)
  if err := os.WriteFile(filepath.Join(root, "second.json"), []byte(swaggerCacheDocument), 0o644); err != nil {
    t.Fatal(err)
  }
  warmSwaggerCache(t, root, "first.json")

  t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
  inventories, problems := loadSwaggerInventories(
    root,
    swaggerCacheConfig(t, "first.json", "second.json"),
  )
  if len(problems) != 0 {
    t.Fatalf("identical bytes must share one entry, got: %v", problems)
  }
  for _, source := range []string{"first.json", "second.json"} {
    targets := swaggerTargets(inventories[source])
    want := "swagger:" + source + ":POST:/members"
    if len(targets) != 1 || targets[0] != want {
      t.Fatalf("source %q must keep its own identity, got %v", source, targets)
    }
  }
}
