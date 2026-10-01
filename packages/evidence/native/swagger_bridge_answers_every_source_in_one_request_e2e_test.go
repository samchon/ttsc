//go:build e2e

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
 * @evidence contracts/testing.md#execution-ownership TestSwaggerBridgeAnswersEverySourceInOneRequest is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls normalizeSwaggerSources (one Node run for two sources). It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary normalizeSwaggerSources starts a Node child (node -e with the embedded Swagger bridge script) that resolves @ttsc/evidence from the fixture root under packages/evidence/native and runs the compiled Swagger normalizer, and Go decodes its JSON. A hand-built result would bypass package resolution, the child and the JSON transport.
 * @evidence contracts/e2e.md#shared-execution normalizeSwaggerSources is called once for both sources, so the test starts 1 Node child process; no resident bridge or batching is used. The only shared prerequisites are the built @ttsc/evidence package and its compiled lib/internal loaders, which this test neither builds nor installs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity swaggerBridgeRoot creates one fixture directory under packages/evidence/native via MkdirTemp and registers RemoveAll with t.Cleanup; the test adds broken.json into it; the child has exited before the call returns. normalizeSwaggerSources does not consult the swagger document cache.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts the document/problem split by source, each source's own digest and a non-blank rejection reason; the reason text itself is not checked.
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
