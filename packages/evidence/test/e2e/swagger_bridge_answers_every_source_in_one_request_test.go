package evidence

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

/**
 * Verifies one normalizer run answers a mixed request for both outcomes.
 *
 * The loader sends every miss in one request, so a bridge that stopped at the
 * first rejection would leave the healthy documents beside it unresolved — and
 * they would be reported as "returned no result", a diagnostic that blames the
 * installation rather than the broken file the author actually has to fix.
 *
 *  1. Normalize one valid document and one unsupported document together.
 *  2. Assert each lands on its own side of the result.
 *  3. Assert both carry the digest of their own bytes.
 *
 * @evidence contracts/testing.md#behavioral-verification normalizeSwaggerSources returns valid and rejected siblings with their own digests and a nonempty rejection reason.
 * @evidence contracts/testing.md#independent-expectations Independently authored valid/unsupported documents and literal names specify each result.
 * @evidence contracts/testing.md#distinguishing-cases One failing source must not discard its valid sibling or impose request-wide identity.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerBridgeAnswersEverySourceInOneRequest is one Go E2E overlay entry at packages/evidence/test/e2e/swagger_bridge_answers_every_source_in_one_request_test.go. The repository runner selects this population separately and overlays it into the native package, preserving access to the actual owner and this function's local case identities.
 * @evidence contracts/e2e.md#necessary-boundary The native Swagger bridge executes Node against the installed evidence package and compiled Swagger loader, then decodes its real response. normalizeSwaggerSources returns valid and rejected siblings with their own digests and a nonempty rejection reason. A supplied DTO cannot prove package resolution, decoder execution or this payload transport.
 * @evidence contracts/e2e.md#shared-execution All cases reuse the pnpm-installed evidence package and compiled loader in one Go E2E test process. This preserved entry issues its own synchronous Node request for its schema/document inputs; no case installs dependencies or builds a native contributor. Distinct parser inputs justify fresh interpretation, but these per-entry Node lifetimes have not been consolidated into one persistent decoder and are a remaining sharing limitation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The swaggerBridgeRoot helper gives this case a private consumer directory under the installed suite and registers t.Cleanup removal. Each synchronous bridge call joins its Node child. The immutable installed loader is shared; loader inventory calls may reuse content-cache outcomes, so this entry does not claim every load is cold. Abrupt process termination may leave the temporary root.
 * @evidence contracts/e2e.md#preserved-coverage TestSwaggerBridgeAnswersEverySourceInOneRequest retains its original function body, local inputs and every assertion after transfer. normalizeSwaggerSources returns valid and rejected siblings with their own digests and a nonempty rejection reason. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
 */
func TestSwaggerBridgeAnswersEverySourceInOneRequest(t *testing.T) {
  root := swaggerBridgeRoot(t, `{"openapi":"3.1.0","info":{"title":"B","version":"1"},"paths":{"/members":{"post":{"responses":{"200":{"description":"OK"}}}}}}`)
  if err := os.WriteFile(
    filepath.Join(root, "broken.json"),
    []byte(`{"openapi":"4.0.0","info":{"title":"B","version":"1"},"paths":{}}`),
    0o644,
  ); err != nil {
    t.Fatal(err)
  }
  result, err := normalizeSwaggerSources(root, []string{"swagger.json", "broken.json"})
  if err != nil {
    t.Fatalf("the bridge must run: %v", err)
  }
  if len(result.Documents) != 1 || result.Documents[0].Source != "swagger.json" {
    t.Fatalf("the valid document must normalize, got %+v", result.Documents)
  }
  if len(result.Problems) != 1 || result.Problems[0].Source != "broken.json" {
    t.Fatalf("the unsupported document must be rejected, got %+v", result.Problems)
  }
  if result.Documents[0].Digest != swaggerContentDigest(root, "swagger.json") ||
    result.Problems[0].Digest != swaggerContentDigest(root, "broken.json") {
    t.Fatal("each source must carry the digest of its own bytes, not of the request")
  }
  if strings.TrimSpace(result.Problems[0].Message) == "" {
    t.Fatal("a rejection must carry the reason the author has to act on")
  }
}
