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
 * @evidence contracts/testing.md#behavioral-verification prismaFieldDigests parses before/after schemas; every resulting digest must be nonempty, Sale and Sale.price must remain equal, and prismaScopeOf must change after currency is added.
 * @evidence contracts/testing.md#independent-expectations A model's own declaration digest excludes its field set, while its aggregate scope includes every field. These equality/inequality relations are contract-derived.
 * @evidence contracts/testing.md#distinguishing-cases Adding one new field distinguishes unit-content stability from subtree-membership change; the composite helper uses production newScopeIndex and cannot independently certify its hash algorithm.
 * @evidence contracts/testing.md#execution-ownership TestAnAddedPrismaFieldMovesTheScopeAndNotTheModel is the selectable E2E Go entry under tests/test-evidence/go/e2e. Its original local cases execute through the native-package overlay runner and the actual installed parser process; its closure and assertions remain owned by this entry.
 * @evidence contracts/e2e.md#necessary-boundary prismaFieldDigests consumes real Node/Prisma parser output before the Go scope computation. The connection must preserve existing unit digests while publishing the added field so its scope changes.
 * @evidence contracts/e2e.md#shared-execution Both schema versions reuse the linked compiled parser prerequisites and helper path; their own field maps remain independent. No per-case dependency installation or native build is introduced.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each schema is written under a separate prismaBridgeRoot and cleaned by t.Cleanup. The before/after maps are local; prismaScopeOf constructs fresh units and scope indexes for each comparison.
 * @evidence contracts/e2e.md#preserved-coverage TestAnAddedPrismaFieldMovesTheScopeAndNotTheModel preserves nonempty checks for every resulting unit, equality of Sale and price, and inequality of the aggregate scope after addition at this address.
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
