package evidence

import (
  "testing"
)

/**
 * Verifies a value path wins over a type-only path to the same name.
 *
 * A population is the union of what its paths reach, and the top level already
 * unions them. One hop down, the surface a barrel is asked for kept whichever
 * path it saw first, which was fine while two paths to one declaration differed
 * in nothing and stopped being fine the moment they carried a mark. The two
 * halves of the traversal have to answer the same way or a middle barrel's
 * statement order decides the obligation.
 *
 *  1. Reach one module through a type-only barrel and a value barrel.
 *  2. Forward both from a middle barrel, in each order, and re-export by name.
 *  3. Assert both orders publish the value population.
 * @evidence contracts/testing.md#behavioral-verification assertReexportedFrom runs the graph rule twice over one module reached through a type-only barrel (`export type *`) and a value barrel (`export *`) forwarded from a middle barrel in both statement orders and re-exported by name from the entry; each run must report exactly IPlain, IPlain.rate, Sale, Sale.prototype.charge, Sale.prototype.price and run.
 * @evidence contracts/testing.md#independent-expectations The expected list is an authored literal of everything the declaring file publishes: a population is the union of its paths, so a value path to the same declaration must win over a type-only path whatever the statement order.
 * @evidence contracts/testing.md#distinguishing-cases The two statement orders are the distinguishing variable; a traversal that kept whichever path it saw first would withhold the value members in the type-only-first order and fail that run. The type-only-only case is owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestAValuePathWinsOverATypeOnlyPathToTheSameName is a Go unit entry in the native test process; assertReexportedFrom calls runIndexRule over temp fixture files for each order and compares the Missing-acknowledgement targets, with no consumer install or product host.
 */
func TestAValuePathWinsOverATypeOnlyPathToTheSameName(t *testing.T) {
  layout := func(middle string) map[string]string {
    return map[string]string{
      "src/sale.ts":   reexportedSurface,
      "src/type.ts":   "export type * from \"./sale.js\";\n",
      "src/value.ts":  "export * from \"./sale.js\";\n",
      "src/middle.ts": middle,
      "src/index.ts":  "export { Sale, IPlain, run } from \"./middle.js\";\n",
    }
  }
  assertReexportedFrom(t, "type-only forwarded first", layout(
    "export * from \"./type.js\";\nexport * from \"./value.js\";\n",
  ), "src/index.ts", valueReexportPopulation)
  assertReexportedFrom(t, "value forwarded first", layout(
    "export * from \"./value.js\";\nexport * from \"./type.js\";\n",
  ), "src/index.ts", valueReexportPopulation)
}
