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
 * @evidence contracts/testing.md#distinguishing-cases A readable two-file set (so the path-plus-hash framing and file order matter); rejected and unreadable sets are covered by sibling tests.
 * @evidence contracts/testing.md#execution-ownership TestPrismaBridgeReportsTheNativeDigest is a Go unit entry of package evidence, run by go test in the package process. It calls the loader functions it names and, through them, the Node parser or normalizer child that the built lib/internal loader provides; it starts no ttsc check, lint sidecar or installed consumer.
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
