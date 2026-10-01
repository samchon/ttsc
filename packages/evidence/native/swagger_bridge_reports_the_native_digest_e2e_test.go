//go:build e2e

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
 * @evidence contracts/testing.md#distinguishing-cases One readable local document; rejected (sibling) and unreadable (sibling) sources are not run here.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerBridgeReportsTheNativeDigest is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls normalizeSwaggerSources (one Node run) and swaggerContentDigest. It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary normalizeSwaggerSources starts a Node child that resolves @ttsc/evidence from the fixture root under packages/evidence/native and runs the compiled Swagger normalizer, and Go decodes its JSON. The Go and Node digests are separate implementations that only the real bridge can compare.
 * @evidence contracts/e2e.md#shared-execution normalizeSwaggerSources is called once, so the test starts 1 Node child process; no resident bridge or batching is used. The only shared prerequisites are the built @ttsc/evidence package and its compiled lib/internal loaders, which this test neither builds nor installs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity swaggerBridgeRoot creates one fixture directory under packages/evidence/native and registers RemoveAll with t.Cleanup; the child exits before the call returns; no swagger cache is consulted.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts one normalized document, a non-empty native digest, and digest equality.
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
