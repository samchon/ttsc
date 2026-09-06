package evidence

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
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
