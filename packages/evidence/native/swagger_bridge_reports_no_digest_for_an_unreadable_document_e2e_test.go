//go:build e2e

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
 * @evidence contracts/testing.md#behavioral-verification A request naming absent.json (never created; only swagger.json exists) returns exactly one problem with an empty digest (L34-L39), and swaggerContentDigest of absent.json is also empty (L40).
 * @evidence contracts/testing.md#independent-expectations Absent.json is never created.
 * @evidence contracts/testing.md#distinguishing-cases Missing bytes cannot authorize a cache identity.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerBridgeReportsNoDigestForAnUnreadableDocument is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls normalizeSwaggerSources (one Node run). It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary normalizeSwaggerSources starts a Node child that resolves @ttsc/evidence from the fixture root under packages/evidence/native and runs the compiled Swagger normalizer, and Go decodes its JSON; a hand-built result would bypass the child and the JSON transport.
 * @evidence contracts/e2e.md#shared-execution normalizeSwaggerSources is called once, so the test starts 1 Node child process; no resident bridge or batching is used. The only shared prerequisites are the built @ttsc/evidence package and its compiled lib/internal loaders, which this test neither builds nor installs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity swaggerBridgeRoot creates one fixture directory under packages/evidence/native and registers RemoveAll with t.Cleanup; the child exits before the call returns; no swagger cache is consulted.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts one problem, an empty bridge digest and an empty native digest for the absent source.
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
