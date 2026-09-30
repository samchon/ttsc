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
 * @evidence contracts/testing.md#behavioral-verification assertReexportedFrom exercises the authored fixture. Assert both orders publish the value population.
 * @evidence contracts/testing.md#independent-expectations A population is the union of what its paths reach, and the top level already unions them. One hop down, the surface a barrel is asked for kept whichever path it saw first, which was fine while two paths to one declaration differed in nothing and stopped being fine the moment they carried a mark. The two halves of the traversal have to answer the same way or a middle barrel's statement order decides the obligation. The authored scenario requires this outcome: Assert both orders publish the value population.
 * @evidence contracts/testing.md#distinguishing-cases Reach one module through a type-only barrel and a value barrel. Forward both from a middle barrel, in each order, and re-export by name. Assert both orders publish the value population.
 * @evidence contracts/testing.md#execution-ownership TestAValuePathWinsOverATypeOnlyPathToTheSameName runs as a Go unit entry in the native package. assertReexportedFrom executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
