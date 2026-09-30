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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification assertReexportedFrom exercises the authored fixture. Assert the entry publishes the type-only population.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The named branch inherits the mark from the path that reached it as well as reading the edge's own, and the inherited half was pinned by nothing: dropping it left the whole suite green while a type-only star over a named barrel published every value the declaring file holds. The authored scenario requires this outcome: Assert the entry publishes the type-only population.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Re-export the module by name from an inner barrel. Re-export that barrel with `export type * from` at the entry. Assert the entry publishes the type-only population.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestATypeOnlyStarWithholdsThroughANamedReexportBelowIt runs as a Go unit entry in the native package. assertReexportedFrom executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestATypeOnlyStarWithholdsThroughANamedReexportBelowIt(t *testing.T) {
  assertReexportedFrom(t, "type-only star over named", map[string]string{
    "src/sale.ts":   reexportedSurface,
    "src/middle.ts": "export { Sale, IPlain, run } from \"./sale.js\";\n",
    "src/index.ts":  "export type * from \"./middle.js\";\n",
  }, "src/index.ts", typeReexportPopulation)
}
