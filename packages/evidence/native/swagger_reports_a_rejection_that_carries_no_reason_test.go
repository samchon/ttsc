package evidence

import (
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies a rejection with no reason is still a rejection.
 *
 * The reason is a string from another process and nothing guarantees it is
 * non-empty. If emptiness were what marked an outcome as a failure, a
 * reason-less rejection would materialize zero operations and report nothing —
 * a refused document that reads exactly like an empty document the graph is
 * content with, which is the shape `test_evidence_graph_reports_swagger_source_failures`
 * exists to forbid.
 *
 *  1. Remember a rejection carrying no message.
 *  2. Load with an unusable normalizer so the entry is what answers.
 *  3. Assert a diagnostic is still reported and no unit materializes.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification loadSwaggerInventories supplies the asserted fallback diagnostic for seeded rejection with empty reason.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Deliberately empty problem and literal fallback message specify required behavior.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Malformed cached reason cannot become silent success.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSwaggerReportsARejectionThatCarriesNoReason is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host. The warmed entry returns before process startup; the unavailable executable is a sentinel for an accidental cache miss, not a claimed real parser.
 */
func TestSwaggerReportsARejectionThatCarriesNoReason(t *testing.T) {
  isolateSwaggerCache(t)
  root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
  swaggerDocuments.store(
    swaggerContentDigest(root, "swagger.json"),
    swaggerDocumentOutcome{Rejected: true},
  )

  t.Setenv("TTSC_NODE_BINARY", filepath.Join(t.TempDir(), "node-that-does-not-exist"))
  inventories, problems := loadSwaggerInventories(root, swaggerCacheConfig(t, "swagger.json"))
  if len(problems) == 0 {
    t.Fatal("a reason-less rejection must still fail the build")
  }
  if !strings.Contains(strings.Join(problemMessages(problems), "\n"), "swagger.json") {
    t.Fatalf("the diagnostic must name the refused source, got: %v", problems)
  }
  if len(inventories["swagger.json"].Units) != 0 {
    t.Fatal("a refused document must materialize no evidence units")
  }
}
