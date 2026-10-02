//go:build e2e

package evidence

import (
  "testing"
)

/**
 * Verifies an added field is the model's scope rather than the model's own
 * content.
 *
 * A model's digest folds in none of its fields, and the boundary matters in
 * both directions. Folding them in would make one field's edit expire a review
 * of every sibling, which is the mass false-expiry this feature exists to avoid
 * at a smaller radius. Leaving the model unable to notice a new field would let
 * a table grow a column with every review of it still green, and the scope
 * composition on this side is what closes that.
 *
 *  1. Parse a model, then parse it with one field added.
 *  2. Assert the model's own digest and the untouched field's are unchanged.
 *  3. Assert the model's composed scope digest is not.
 *
 * @evidence contracts/testing.md#behavioral-verification Two schemas are parsed through the real bridge (Sale{id,price} and the same plus currency). Every digest in the after map must be non-empty, the Sale and Sale.price digests must equal their before values, and prismaScopeOf of the before units must differ from that of the after units.
 * @evidence contracts/testing.md#independent-expectations A model's own declaration digest excludes its field set, while its aggregate scope includes every field. These equality/inequality relations are contract-derived.
 * @evidence contracts/testing.md#distinguishing-cases Adding one new field distinguishes unit-content stability from subtree-membership change; the composite helper uses production newScopeIndex and cannot independently certify its hash algorithm.
 * @evidence contracts/testing.md#execution-ownership TestAnAddedPrismaFieldMovesTheScopeAndNotTheModel is a Go test entry of package evidence run by the shared Evidence E2E experiment with go test -tags=e2e of packages/evidence; it calls prismaFieldDigests (two Node bridge runs) and prismaScopeOf (a Go composition over newScopeIndex). It starts no native sidecar and builds no TypeScript project.
 * @evidence contracts/e2e.md#necessary-boundary prismaFieldDigests consumes real Node/Prisma parser output before the Go scope computation. The connection must preserve existing unit digests while publishing the added field so its scope changes.
 * @evidence contracts/e2e.md#shared-execution prismaFieldDigests is called twice (before and after), so the test starts 2 Node child processes; no resident bridge or batching is used. The only shared prerequisites are the built @ttsc/evidence package and its compiled lib/internal loaders, which this test neither builds nor installs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each schema is written under a separate prismaBridgeRoot and cleaned by t.Cleanup. The before/after maps are local; prismaScopeOf constructs fresh units and scope indexes for each comparison.
 * @evidence contracts/e2e.md#preserved-coverage The body asserts non-empty after-digests, unchanged Sale and Sale.price digests and a changed scope digest; the id column and the new currency column are not compared individually.
 */
func TestAnAddedPrismaFieldMovesTheScopeAndNotTheModel(t *testing.T) {
  before := prismaFieldDigests(t, `model Sale {
  id String @id
  price Int
}
`)
  after := prismaFieldDigests(t, `model Sale {
  id String @id
  price Int
  currency String
}
`)
  for target, digest := range after {
    if digest == "" {
      t.Fatalf("%s carries no digest, so every comparison here passes on emptiness", target)
    }
  }
  if before["Sale"] != after["Sale"] {
    t.Fatal("adding a field moved the model's own digest, so a review of the model expires on every sibling's edit too")
  }
  if before["Sale.price"] != after["Sale.price"] {
    t.Fatal("adding a field moved an untouched sibling's digest")
  }
  if prismaScopeOf(before) == prismaScopeOf(after) {
    t.Fatal("adding a field left the model's scope digest unmoved, so a review of the model survives a new column")
  }
}
