package evidence

import (
  "testing"
)

/**
 * Verifies the normalizer reports the same digest the native side computes for
 * the same file.
 *
 * This is the one part of the cache that fails in total silence. The two halves
 * hash in different languages — Go over the bytes it read, Node over the bytes
 * it read — and if they ever disagree, every lookup misses, every cycle spawns,
 * and every result stays correct. Nothing goes red; the feature simply stops
 * existing, and no test of either half alone would notice.
 *
 * It runs the real bridge rather than a stand-in, because a stand-in would be
 * this repository agreeing with itself about an encoding question that only the
 * two real implementations can settle.
 *
 *  1. Normalize one document through the actual Node bridge.
 *  2. Compute the same file's digest natively.
 *  3. Assert the two agree and are not empty.
 *
 * @evidence contracts/testing.md#behavioral-verification normalizeSwaggerSources returns one document matching the nonempty native file digest.
 * @evidence contracts/testing.md#independent-expectations Node/native implementations separately read the fixture; equality proves interoperability rather than third-oracle hash correctness.
 * @evidence contracts/testing.md#distinguishing-cases Readable local success publishes identity across the bridge.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerBridgeReportsTheNativeDigest is one Go E2E overlay entry at packages/evidence/test/e2e/swagger_bridge_reports_the_native_digest_test.go. The repository runner selects this population separately and overlays it into the native package, preserving access to the actual owner and this function's local case identities.
 * @evidence contracts/e2e.md#necessary-boundary The native Swagger bridge executes Node against the installed evidence package and compiled Swagger loader, then decodes its real response. normalizeSwaggerSources returns one document matching the nonempty native file digest. A supplied DTO cannot prove package resolution, decoder execution or this payload transport.
 * @evidence contracts/e2e.md#shared-execution All cases reuse the pnpm-installed evidence package and compiled loader in one Go E2E test process. This preserved entry issues its own synchronous Node request for its schema/document inputs; no case installs dependencies or builds a native contributor. Distinct parser inputs justify fresh interpretation, but these per-entry Node lifetimes have not been consolidated into one persistent decoder and are a remaining sharing limitation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The swaggerBridgeRoot helper gives this case a private consumer directory under the installed suite and registers t.Cleanup removal. Each synchronous bridge call joins its Node child. The immutable installed loader is shared; loader inventory calls may reuse content-cache outcomes, so this entry does not claim every load is cold. Abrupt process termination may leave the temporary root.
 * @evidence contracts/e2e.md#preserved-coverage TestSwaggerBridgeReportsTheNativeDigest retains its original function body, local inputs and every assertion after transfer. normalizeSwaggerSources returns one document matching the nonempty native file digest. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
 */
func TestSwaggerBridgeReportsTheNativeDigest(t *testing.T) {
  root := swaggerBridgeRoot(t, `{"openapi":"3.1.0","info":{"title":"B","version":"1"},"paths":{"/members":{"post":{"responses":{"200":{"description":"OK"}}}}}}`)
  result, err := normalizeSwaggerSources(root, []string{"swagger.json"})
  if err != nil {
    t.Fatalf("the bridge must run: %v", err)
  }
  if len(result.Documents) != 1 {
    t.Fatalf("expected one normalized document, got %d (%v)", len(result.Documents), result.Problems)
  }
  native := swaggerContentDigest(root, "swagger.json")
  if native == "" {
    t.Fatal("the native side must hash a readable document")
  }
  if result.Documents[0].Digest != native {
    t.Fatalf(
      "the bridge and the native side must hash the same bytes identically\n  bridge: %q\n  native: %q",
      result.Documents[0].Digest,
      native,
    )
  }
}
