package evidence

import (
  "testing"
)

/**
 * Verifies the loader reports the same digest the native side computes for the
 * same set.
 *
 * This is the one part of the cache that fails in total silence. The two halves
 * hash in different languages — Go over the bytes it read, Node over the bytes
 * it read — and if they ever disagree, every lookup misses, every cycle spawns,
 * and every result stays correct. Nothing goes red; the feature simply stops
 * existing, and no test of either half alone would notice.
 *
 * It runs the real bridge rather than a stand-in, because a stand-in would be
 * this repository agreeing with itself about a composition question only the
 * two real implementations can settle.
 *
 *  1. Parse a two-file set through the actual Node bridge.
 *  2. Compose the same set's digest natively.
 *  3. Assert the two agree and are not empty.
 *
 * @evidence contracts/testing.md#behavioral-verification normalizePrismaSet returns one parsed set matching the nonempty native digest.
 * @evidence contracts/testing.md#independent-expectations Node and native hashing are separate implementations of the source-set framing; equality proves interoperability, not correctness against a third oracle.
 * @evidence contracts/testing.md#distinguishing-cases Readable multi-file success contrasts with unreadable/rejected sets.
 * @evidence contracts/testing.md#execution-ownership TestPrismaBridgeReportsTheNativeDigest is one Go E2E overlay entry at tests/test-evidence/go/e2e/prisma_bridge_reports_the_native_digest_test.go. The repository runner selects this population separately and overlays it into the native package, preserving access to the actual owner and this function's local case identities.
 * @evidence contracts/e2e.md#necessary-boundary The native Prisma bridge executes Node against the installed evidence package and compiled Prisma loader, then decodes its real response. normalizePrismaSet returns one parsed set matching the nonempty native digest. A supplied DTO cannot prove package resolution, decoder execution or this payload transport.
 * @evidence contracts/e2e.md#shared-execution All cases reuse the pnpm-installed evidence package and compiled loader in one Go E2E test process. This preserved entry issues its own synchronous Node request for its schema/document inputs; no case installs dependencies or builds a native contributor. Distinct parser inputs justify fresh interpretation, but these per-entry Node lifetimes have not been consolidated into one persistent decoder and are a remaining sharing limitation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The prismaBridgeRoot helper gives this case a private consumer directory under the installed suite and registers t.Cleanup removal. Each synchronous bridge call joins its Node child. The immutable installed loader is shared; loader inventory calls may reuse content-cache outcomes, so this entry does not claim every load is cold. Abrupt process termination may leave the temporary root.
 * @evidence contracts/e2e.md#preserved-coverage TestPrismaBridgeReportsTheNativeDigest retains its original function body, local inputs and every assertion after transfer. normalizePrismaSet returns one parsed set matching the nonempty native digest. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
 */
func TestPrismaBridgeReportsTheNativeDigest(t *testing.T) {
  sources := []string{"prisma/schema.prisma", "prisma/seller.prisma"}
  root := prismaBridgeRoot(t, map[string]string{
    sources[0]: prismaBridgeSchema,
    sources[1]: "model Extra {\n  id String @id @db.Uuid\n}\n",
  })
  result, err := normalizePrismaSet(root, sources)
  if err != nil {
    t.Fatalf("the bridge must run: %v", err)
  }
  if len(result.Documents) != 1 {
    t.Fatalf("expected one parsed set, got %d (%v)", len(result.Documents), result.Problems)
  }
  native := prismaContentDigest(root, sources)
  if native == "" {
    t.Fatal("the native side must hash a readable set")
  }
  if result.Documents[0].Digest != native {
    t.Fatalf(
      "the bridge and the native side must compose the same key\n  bridge: %q\n  native: %q",
      result.Documents[0].Digest,
      native,
    )
  }
}
