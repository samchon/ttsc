package evidence

import (
  "testing"
)

/**
 * Verifies a document the bridge cannot read at all reports no digest.
 *
 * There are no bytes to attribute an outcome to, so remembering one would key a
 * result on a file that was never read. The native side already declines to
 * hash a missing file; this pins the other end of the same rule, so neither
 * side is the only thing standing between an unreadable source and the cache.
 *
 *  1. Normalize a source that does not exist.
 *  2. Assert it comes back as a problem.
 *  3. Assert its digest is empty.
 *
 * @evidence contracts/testing.md#behavioral-verification normalizeSwaggerSources returns one absent-source problem with empty digest and native hashing also declines it.
 * @evidence contracts/testing.md#independent-expectations Absent.json is never created.
 * @evidence contracts/testing.md#distinguishing-cases Missing bytes cannot authorize a cache identity.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerBridgeReportsNoDigestForAnUnreadableDocument is one Go E2E overlay entry at tests/test-evidence/go/e2e/swagger_bridge_reports_no_digest_for_an_unreadable_document_test.go. The repository runner selects this population separately and overlays it into the native package, preserving access to the actual owner and this function's local case identities.
 * @evidence contracts/e2e.md#necessary-boundary The native Swagger bridge executes Node against the installed evidence package and compiled Swagger loader, then decodes its real response. normalizeSwaggerSources returns one absent-source problem with empty digest and native hashing also declines it. A supplied DTO cannot prove package resolution, decoder execution or this payload transport.
 * @evidence contracts/e2e.md#shared-execution All cases reuse the pnpm-installed evidence package and compiled loader in one Go E2E test process. This preserved entry issues its own synchronous Node request for its schema/document inputs; no case installs dependencies or builds a native contributor. Distinct parser inputs justify fresh interpretation, but these per-entry Node lifetimes have not been consolidated into one persistent decoder and are a remaining sharing limitation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The swaggerBridgeRoot helper gives this case a private consumer directory under the installed suite and registers t.Cleanup removal. Each synchronous bridge call joins its Node child. The immutable installed loader is shared; loader inventory calls may reuse content-cache outcomes, so this entry does not claim every load is cold. Abrupt process termination may leave the temporary root.
 * @evidence contracts/e2e.md#preserved-coverage TestSwaggerBridgeReportsNoDigestForAnUnreadableDocument retains its original function body, local inputs and every assertion after transfer. normalizeSwaggerSources returns one absent-source problem with empty digest and native hashing also declines it. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
 */
func TestSwaggerBridgeReportsNoDigestForAnUnreadableDocument(t *testing.T) {
  root := swaggerBridgeRoot(t, `{"openapi":"3.1.0","paths":{}}`)
  result, err := normalizeSwaggerSources(root, []string{"absent.json"})
  if err != nil {
    t.Fatalf("the bridge must run: %v", err)
  }
  if len(result.Problems) != 1 {
    t.Fatalf("expected one rejected source, got %d", len(result.Problems))
  }
  if result.Problems[0].Digest != "" {
    t.Fatalf("an unread source must carry no digest, got %q", result.Problems[0].Digest)
  }
  if swaggerContentDigest(root, "absent.json") != "" {
    t.Fatal("the native side must decline to hash a missing file")
  }
}
