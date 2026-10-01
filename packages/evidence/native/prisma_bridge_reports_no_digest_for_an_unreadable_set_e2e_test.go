//go:build e2e

package evidence

import (
  "testing"
)

/**
 * Verifies a set the bridge cannot read at all reports no digest.
 *
 * There are no bytes to attribute an outcome to, so remembering one would key a
 * result on files that were never read. The native side already declines to
 * hash an unreadable set; this pins the other end of the same rule, so neither
 * side is the only thing standing between a missing schema and the cache.
 *
 *  1. Parse a set naming a file that does not exist.
 *  2. Assert it comes back as a problem.
 *  3. Assert its digest is empty.
 *
 * @evidence contracts/testing.md#behavioral-verification normalizePrismaSet reports one problem with empty digest and native hashing declines the absent source.
 * @evidence contracts/testing.md#independent-expectations The requested schema is never created, so no bytes establish identity.
 * @evidence contracts/testing.md#distinguishing-cases A set naming only a file that does not exist; readable rejected and readable successful sets are in sibling tests.
 * @evidence contracts/testing.md#execution-ownership TestPrismaBridgeReportsNoDigestForAnUnreadableSet is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls normalizePrismaSet (one Node run) and prismaContentDigest. It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary normalizePrismaSet starts a Node child (node -e with the embedded bridge script) that resolves @ttsc/evidence from the fixture root created under packages/evidence/native through Node package self-reference and runs lib/internal/loadPrismaModels.js with a Prisma schema parser, and Go decodes the child's JSON. A hand-built result struct would bypass package resolution, the child process and the JSON transport.
 * @evidence contracts/e2e.md#shared-execution normalizePrismaSet is called once, so the test starts 1 Node child process; no resident bridge or batching is used. The only shared prerequisites are the built @ttsc/evidence package and its compiled lib/internal loaders, which this test neither builds nor installs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity prismaBridgeRoot creates 1 fixture directory under packages/evidence/native via MkdirTemp and registers RemoveAll with t.Cleanup; each Node child has exited before its call returns. normalizePrismaSet does not consult the in-process schema cache, so no warm or cold cache state is involved.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts one problem with an empty digest from the bridge and an empty native digest for the same absent source.
 */
func TestPrismaBridgeReportsNoDigestForAnUnreadableSet(t *testing.T) {
  root := prismaBridgeRoot(t, map[string]string{
    "prisma/schema.prisma": prismaBridgeSchema,
  })
  result, err := normalizePrismaSet(root, []string{"prisma/absent.prisma"})
  if err != nil {
    t.Fatalf("the bridge must run: %v", err)
  }
  if len(result.Problems) != 1 {
    t.Fatalf("expected one rejected set, got %d", len(result.Problems))
  }
  if result.Problems[0].Digest != "" {
    t.Fatalf("an unread set must carry no digest, got %q", result.Problems[0].Digest)
  }
  if prismaContentDigest(root, []string{"prisma/absent.prisma"}) != "" {
    t.Fatal("the native side must decline to hash a missing file")
  }
}
