package evidence

import (
  "testing"
)

/**
 * Verifies a cached schema set serves the digests it stored.
 *
 * The cache copies a parsed set field by field so that only the field slice is
 * reallocated, which means every field the copy does not name is served as its
 * zero value on a hit and correctly on a miss. The model's own digest was one.
 * A resident host therefore asked for one fingerprint on its first cycle and a
 * different one on every cycle after, so a single `ttsc check` and a watch
 * session disagreed permanently on every model citation and no edit could
 * repair it.
 *
 *  1. Store a parsed set carrying model and field digests.
 *  2. Read it back.
 *  3. Assert both digests survived.
 *
 * @evidence contracts/testing.md#behavioral-verification newPrismaCache stores a literal Sale model and price field, then lookup must hit with exactly one model/field and both original digest strings.
 * @evidence contracts/testing.md#independent-expectations The cache is a transport for supplied normalized digests; the authored strings establish exact preservation independently.
 * @evidence contracts/testing.md#distinguishing-cases This successful round trip owns presence and field fidelity, not invalidation or parser normalization; it starts with a new private cache.
 * @evidence contracts/testing.md#execution-ownership TestACachedPrismaSetServesTheDigestsItStored is a selectable native Go unit entry exercising the owning operations named in its behavioral answer in-process. Its direct fixture values and local comparisons require no installed artifact or product process.
 */
func TestACachedPrismaSetServesTheDigestsItStored(t *testing.T) {
  cache := newPrismaCache()
  cache.store("set-key", prismaSetOutcome{Models: []prismaModel{{
    Name:   "Sale",
    Digest: "model-digest",
    Fields: []prismaField{{Name: "price", Symbol: "column", Digest: "price-digest"}},
  }}})
  served, found := cache.lookup("set-key")
  if !found {
    t.Fatal("the entry just stored was not found")
  }
  if len(served.Models) != 1 || len(served.Models[0].Fields) != 1 {
    t.Fatalf("served %d models", len(served.Models))
  }
  if served.Models[0].Digest != "model-digest" {
    t.Fatalf("served model digest %q, want %q", served.Models[0].Digest, "model-digest")
  }
  if served.Models[0].Fields[0].Digest != "price-digest" {
    t.Fatalf("served field digest %q, want %q", served.Models[0].Fields[0].Digest, "price-digest")
  }
}
