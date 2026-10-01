package evidence

import (
  "testing"
)

/**
 * Verifies a type-only star withholds through a value star below it.
 *
 * The other direction of the same term, and the one the recursive calls carry:
 * dropping the inherited mark from the star and namespace branches also left
 * the whole suite green, because nothing walked two star hops.
 *
 *  1. Re-export the module by value from an inner barrel.
 *  2. Re-export that barrel with `export type * from` at the entry.
 *  3. Assert the entry publishes the type-only population.
 * @evidence contracts/testing.md#behavioral-verification assertReexportedFrom runs the graph rule over src/sale.ts, an inner barrel `export * from "./sale.js"`, and an entry `export type * from "./inner.js"`, and requires the entry's unacknowledged population to equal exactly IPlain, IPlain.rate and Sale.
 * @evidence contracts/testing.md#independent-expectations The expected list is an authored literal: through two star hops with the outer one type-only, only type-space names and interface members remain, so Sale's value members and `run` must not be published.
 * @evidence contracts/testing.md#distinguishing-cases A two-star-hop chain with the type-only edge above the value star; it fails if the mark is not carried down the recursive star call. The named and namespace shapes are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestATypeOnlyStarWithholdsThroughAValueStarBelowIt is a Go unit entry in the native test process; assertReexportedFrom calls runIndexRule over temp fixture files and compares the Missing-acknowledgement targets, with no consumer install or product host.
 */
func TestATypeOnlyStarWithholdsThroughAValueStarBelowIt(t *testing.T) {
  assertReexportedFrom(t, "type-only over value", map[string]string{
    "src/sale.ts":  reexportedSurface,
    "src/inner.ts": "export * from \"./sale.js\";\n",
    "src/index.ts": "export type * from \"./inner.js\";\n",
  }, "src/index.ts", typeReexportPopulation)
}
