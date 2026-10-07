package evidence

import (
  "testing"
)

/**
 * Verifies identical bytes in identical order reproduce the same key.
 *
 * The other half of the same contract: a digest that varied across runs would
 * make every cycle a miss, which costs a process spawn per rebuild while every
 * result stays correct. Nothing would go red, and the feature would simply not
 * exist.
 *
 *  1. Digest one set twice from two separate roots holding the same bytes.
 *  2. Assert the keys agree.
 *
 * @evidence contracts/testing.md#behavioral-verification prismaContentDigest gives identical nonempty keys for identical relative paths/bytes across roots.
 * @evidence contracts/testing.md#independent-expectations Copied authored inputs establish equivalence; no literal cryptographic hash oracle is claimed.
 * @evidence contracts/testing.md#distinguishing-cases Disposable absolute roots do not alter reusable identity.
 * @evidence contracts/testing.md#execution-ownership TestPrismaDigestIsStableAcrossRoots is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestPrismaDigestIsStableAcrossRoots(t *testing.T) {
  files := map[string]string{
    "prisma/a.prisma": "model A {\n  id String @id\n}\n",
    "prisma/b.prisma": "model B {\n  id String @id\n}\n",
  }
  sources := []string{"prisma/a.prisma", "prisma/b.prisma"}
  first := prismaContentDigest(prismaDigestRoot(t, files), sources)
  second := prismaContentDigest(prismaDigestRoot(t, files), sources)
  if first == "" || first != second {
    t.Fatalf("the same bytes must key the same: %q vs %q", first, second)
  }
}
