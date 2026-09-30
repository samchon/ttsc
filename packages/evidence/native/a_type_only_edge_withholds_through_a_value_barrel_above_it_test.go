package evidence

import (
  "testing"
)

/**
 * Verifies a type-only edge withholds through a value barrel above it.
 *
 * The mark travels rather than being read at the entry, so a value re-export of
 * a type-only re-export publishes what the inner edge allowed. Every complementary row
 * is one hop, and dropping the term that carries a nested surface's own mark
 * left the whole suite green.
 *
 *  1. Re-export type-only from an inner barrel.
 *  2. Re-export that barrel by name from the entry.
 *  3. Assert the entry publishes the type-only population.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification assertReexportedFrom exercises the authored fixture. Assert the entry publishes the type-only population.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The mark travels rather than being read at the entry, so a value re-export of a type-only re-export publishes what the inner edge allowed. Every complementary row is one hop, and dropping the term that carries a nested surface's own mark left the whole suite green. The authored scenario requires this outcome: Assert the entry publishes the type-only population.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Re-export type-only from an inner barrel. Re-export that barrel by name from the entry. Assert the entry publishes the type-only population.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestATypeOnlyEdgeWithholdsThroughAValueBarrelAboveIt runs as a Go unit entry in the native package. assertReexportedFrom executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestATypeOnlyEdgeWithholdsThroughAValueBarrelAboveIt(t *testing.T) {
  assertReexportedFrom(t, "value over type-only", map[string]string{
    "src/sale.ts":  reexportedSurface,
    "src/inner.ts": "export type { Sale, IPlain, run } from \"./sale.js\";\n",
    "src/index.ts": "export { Sale, IPlain, run } from \"./inner.js\";\n",
  }, "src/index.ts", typeReexportPopulation)
}
