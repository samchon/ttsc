package evidence

import (
  "testing"
)

/**
 * Verifies a type-only star withholds through a namespace re-export below it.
 *
 * The third branch that carries an inherited mark, and the last one nothing
 * pinned. It also keeps the segment, so the row states that the withholding
 * travels with the address rather than being decided where the address starts.
 *
 *  1. Re-export the module as a namespace from an inner barrel.
 *  2. Re-export that barrel with `export type * from` at the entry.
 *  3. Assert the entry publishes the type-only population under the segment.
 * @evidence contracts/testing.md#behavioral-verification assertReexportedFrom exercises the authored fixture. Assert the entry publishes the type-only population under the segment.
 * @evidence contracts/testing.md#independent-expectations The third branch that carries an inherited mark, and the last one nothing pinned. It also keeps the segment, so the row states that the withholding travels with the address rather than being decided where the address starts. The authored scenario requires this outcome: Assert the entry publishes the type-only population under the segment.
 * @evidence contracts/testing.md#distinguishing-cases Re-export the module as a namespace from an inner barrel. Re-export that barrel with `export type * from` at the entry. Assert the entry publishes the type-only population under the segment.
 * @evidence contracts/testing.md#execution-ownership TestATypeOnlyStarWithholdsThroughANamespaceReexportBelowIt runs as a Go unit entry in the native package. assertReexportedFrom executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestATypeOnlyStarWithholdsThroughANamespaceReexportBelowIt(t *testing.T) {
  assertReexportedFrom(t, "type-only star over namespace", map[string]string{
    "src/sale.ts":   reexportedSurface,
    "src/middle.ts": "export * as api from \"./sale.js\";\n",
    "src/index.ts":  "export type * from \"./middle.js\";\n",
  }, "src/index.ts", []string{"api.IPlain", "api.IPlain.rate", "api.Sale"})
}
