package evidence

import (
  "github.com/samchon/ttsc/packages/lint/rule"
  "path/filepath"
  "strings"
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
 * @evidence contracts/testing.md#behavioral-verification loadSwaggerInventories replays one cache-seeded rejection ('rejected source') with the reference severity set to error and then to warning; exactly one finding must carry the current severity and contain the seeded reason.
 * @evidence contracts/testing.md#independent-expectations A fixed seeded rejection and explicit warning/error levels establish independent expectations.
 * @evidence contracts/testing.md#distinguishing-cases The configured severity is the property that changes the expected level over the same cached rejection. The replayed message must contain the seeded reason, which the normalizer-unavailable fallback message would not, so a cache miss fails the test. No success, empty or recovery case is exercised.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerCachedFailureUsesCurrentSeverity is a selectable native Go unit entry. It seeds the swaggerDocuments cache and calls loadSwaggerInventories over a one-file temp fixture; TTSC_NODE_BINARY names an absent executable so an accidental cache miss cannot spawn Node; the test runs in-process and starts no consumer, Node process, native build or product host.
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
    if !strings.Contains(findings[0].Message, "rejected source") {
      t.Fatalf("the cached rejection was not replayed: %#v", findings)
    }
  }
}
