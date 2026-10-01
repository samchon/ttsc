package evidence

import (
  "testing"
)

/**
 * Verifies a type-only star withholds through a named re-export below it.
 *
 * The named branch inherits the mark from the path that reached it as well as
 * reading the edge's own, and the inherited half was pinned by nothing: dropping
 * it left the whole suite green while a type-only star over a named barrel
 * published every value the declaring file holds.
 *
 *  1. Re-export the module by name from an inner barrel.
 *  2. Re-export that barrel with `export type * from` at the entry.
 *  3. Assert the entry publishes the type-only population.
 * @evidence contracts/testing.md#behavioral-verification assertReexportedFrom runs the graph rule over src/sale.ts (class Sale, interface IPlain, function run), a middle barrel that re-exports those three names by value, and an entry `export type * from "./middle.js"`, and requires the entry's unacknowledged population to equal exactly IPlain, IPlain.rate and Sale.
 * @evidence contracts/testing.md#independent-expectations The expected list is an authored literal from the type-only contract: through a type-only star only type-space names and interface members remain, so Sale's value members and `run` must be withheld even though the barrel below re-exports them by value.
 * @evidence contracts/testing.md#distinguishing-cases The type-only edge sits above a named value re-export, which is the inherited-mark path of the named branch; the other below-the-star shapes (namespace and value star) and the value-barrel-above shape are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestATypeOnlyStarWithholdsThroughANamedReexportBelowIt is a Go unit entry in the native test process; assertReexportedFrom calls runIndexRule over temp fixture files and compares the Missing-acknowledgement targets, with no consumer install or product host.
 */
func TestATypeOnlyStarWithholdsThroughANamedReexportBelowIt(t *testing.T) {
  assertReexportedFrom(t, "type-only star over named", map[string]string{
    "src/sale.ts":   reexportedSurface,
    "src/middle.ts": "export { Sale, IPlain, run } from \"./sale.js\";\n",
    "src/index.ts":  "export type * from \"./middle.js\";\n",
  }, "src/index.ts", typeReexportPopulation)
}
