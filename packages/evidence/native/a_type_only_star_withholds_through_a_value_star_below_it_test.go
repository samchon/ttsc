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
 * @evidence contracts/testing.md#behavioral-verification assertReexportedFrom exercises the authored fixture. Assert the entry publishes the type-only population.
 * @evidence contracts/testing.md#independent-expectations The other direction of the same term, and the one the recursive calls carry: dropping the inherited mark from the star and namespace branches also left the whole suite green, because nothing walked two star hops. The authored scenario requires this outcome: Assert the entry publishes the type-only population.
 * @evidence contracts/testing.md#distinguishing-cases Re-export the module by value from an inner barrel. Re-export that barrel with `export type * from` at the entry. Assert the entry publishes the type-only population.
 * @evidence contracts/testing.md#execution-ownership TestATypeOnlyStarWithholdsThroughAValueStarBelowIt runs as a Go unit entry in the native package. assertReexportedFrom executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestATypeOnlyStarWithholdsThroughAValueStarBelowIt(t *testing.T) {
  assertReexportedFrom(t, "type-only over value", map[string]string{
    "src/sale.ts":  reexportedSurface,
    "src/inner.ts": "export * from \"./sale.js\";\n",
    "src/index.ts": "export type * from \"./inner.js\";\n",
  }, "src/index.ts", typeReexportPopulation)
}
