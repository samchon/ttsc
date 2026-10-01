//go:build e2e

package evidence

import (
  "testing"
)

/**
 * Verifies a rejected document still reports its digest.
 *
 * A rejection is remembered under the bytes that produced it, so a normalizer
 * that returned a digest only on success would leave every broken document
 * re-normalized on every cycle — the state where the edit loop is tightest and
 * the spawn hurts most. The failure would be invisible, because the diagnostic
 * is identical either way.
 *
 *  1. Normalize a document whose OpenAPI version is unsupported.
 *  2. Assert it comes back as a problem rather than an inventory.
 *  3. Assert the problem carries the same digest the native side computes.
 *
 * @evidence contracts/testing.md#behavioral-verification A document with openapi 4.0.0 is normalized; the bridge must return exactly one problem (L35) whose digest equals swaggerContentDigest of the same file (L39). The reason text is not asserted.
 * @evidence contracts/testing.md#independent-expectations Literal OpenAPI4 is unsupported but readable, so known bytes attribute the rejection.
 * @evidence contracts/testing.md#distinguishing-cases Readable rejection keeps identity unlike unreadable input.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerBridgeReportsADigestForARejectedDocument is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls normalizeSwaggerSources (one Node run). It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary normalizeSwaggerSources starts a Node child that resolves @ttsc/evidence from the fixture root under packages/evidence/native and runs the compiled Swagger normalizer, and Go decodes its JSON; a hand-built result would bypass the child and the JSON transport.
 * @evidence contracts/e2e.md#shared-execution normalizeSwaggerSources is called once, so the test starts 1 Node child process; no resident bridge or batching is used. The only shared prerequisites are the built @ttsc/evidence package and its compiled lib/internal loaders, which this test neither builds nor installs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity swaggerBridgeRoot creates one fixture directory under packages/evidence/native and registers RemoveAll with t.Cleanup; the child exits before the call returns; no swagger cache is consulted.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts one problem and equality of its digest with the native digest; the problem text is not examined.
 */
func TestSwaggerBridgeReportsADigestForARejectedDocument(t *testing.T) {
  root := swaggerBridgeRoot(t, `{"openapi":"4.0.0","info":{"title":"B","version":"1"},"paths":{}}`)
  result, err := normalizeSwaggerSources(root, []string{"swagger.json"})
  if err != nil {
    t.Fatalf("the bridge must run: %v", err)
  }
  if len(result.Problems) != 1 {
    t.Fatalf("expected one rejected document, got %d (%v)", len(result.Problems), result.Documents)
  }
  native := swaggerContentDigest(root, "swagger.json")
  if result.Problems[0].Digest != native {
    t.Fatalf(
      "a rejection must be attributable to the bytes that caused it\n  bridge: %q\n  native: %q",
      result.Problems[0].Digest,
      native,
    )
  }
}
