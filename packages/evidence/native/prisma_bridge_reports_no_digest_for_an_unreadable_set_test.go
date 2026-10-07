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
 * @evidence contracts/testing.md#execution-ownership TestPrismaBridgeReportsNoDigestForAnUnreadableSet is a Go unit entry of package evidence, run by go test in the package process. It calls the loader functions it names and, through them, the Node parser or normalizer child that the built lib/internal loader provides; it starts no ttsc check, lint sidecar or installed consumer.
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
