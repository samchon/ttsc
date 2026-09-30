package evidence

import (
  "github.com/samchon/ttsc/packages/lint/rule"
  "path/filepath"
  "testing"
)

/**
 * Verifies cached Swagger failures use the current reference severity.
 *
 * A resident graph reuses normalized sources across config changes. Caching
 * severity with that result would leave a warning as an error after an edit.
 *
 * 1. Cache a rejected source and make the normalizer unavailable.
 * 2. Evaluate it at error and warning levels without editing the source.
 * 3. Assert each cached diagnostic uses the current level.
 *
 * @evidence contracts/testing.md#behavioral-verification loadSwaggerInventories replays one cached rejection at each configured severity.
 * @evidence contracts/testing.md#independent-expectations A fixed seeded rejection and explicit warning/error levels establish independent expectations.
 * @evidence contracts/testing.md#distinguishing-cases Warm payload does not retain an old diagnostic level or start normalization.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerCachedFailureUsesCurrentSeverity is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host. The warmed entry returns before process startup; the unavailable executable is a sentinel for an accidental cache miss, not a claimed real parser.
 */
func TestSwaggerCachedFailureUsesCurrentSeverity(t *testing.T) {
  isolateSwaggerCache(t)
  root := writeInventoryFixture(t, "swagger.json", swaggerCacheDocument)
  swaggerDocuments.store(swaggerContentDigest(root, "swagger.json"), swaggerDocumentOutcome{Rejected: true, Problem: "rejected source"})
  t.Setenv("TTSC_NODE_BINARY", filepath.Join(root, "missing-node"))
  for _, severity := range []rule.Severity{rule.SeverityError, rule.SeverityWarn} {
    config := swaggerCacheConfig(t, "swagger.json")
    config.Claims[0].References[0].Severity = &severity
    resolveGraphSeverities(&config, rule.SeverityError)
    _, findings := loadSwaggerInventories(root, config)
    if len(findings) != 1 || findings[0].Severity != severity {
      t.Fatalf("cached source retained a stale level: %#v", findings)
    }
  }
}
