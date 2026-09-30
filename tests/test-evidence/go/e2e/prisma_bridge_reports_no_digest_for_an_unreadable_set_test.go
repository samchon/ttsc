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
 * @evidence contracts/testing.md#distinguishing-cases Unreadable failure cannot be keyed like a readable rejection.
 * @evidence contracts/testing.md#execution-ownership TestPrismaBridgeReportsNoDigestForAnUnreadableSet is one Go E2E overlay entry at tests/test-evidence/go/e2e/prisma_bridge_reports_no_digest_for_an_unreadable_set_test.go. The repository runner selects this population separately and overlays it into the native package, preserving access to the actual owner and this function's local case identities.
 * @evidence contracts/e2e.md#necessary-boundary The native Prisma bridge executes Node against the installed evidence package and compiled Prisma loader, then decodes its real response. normalizePrismaSet reports one problem with empty digest and native hashing declines the absent source. A supplied DTO cannot prove package resolution, decoder execution or this payload transport.
 * @evidence contracts/e2e.md#shared-execution All cases reuse the pnpm-installed evidence package and compiled loader in one Go E2E test process. This preserved entry issues its own synchronous Node request for its schema/document inputs; no case installs dependencies or builds a native contributor. Distinct parser inputs justify fresh interpretation, but these per-entry Node lifetimes have not been consolidated into one persistent decoder and are a remaining sharing limitation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The prismaBridgeRoot helper gives this case a private consumer directory under the installed suite and registers t.Cleanup removal. Each synchronous bridge call joins its Node child. The immutable installed loader is shared; loader inventory calls may reuse content-cache outcomes, so this entry does not claim every load is cold. Abrupt process termination may leave the temporary root.
 * @evidence contracts/e2e.md#preserved-coverage TestPrismaBridgeReportsNoDigestForAnUnreadableSet retains its original function body, local inputs and every assertion after transfer. normalizePrismaSet reports one problem with empty digest and native hashing declines the absent source. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
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
