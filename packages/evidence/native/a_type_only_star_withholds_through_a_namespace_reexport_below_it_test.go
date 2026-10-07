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
 *
 * @evidence contracts/testing.md#behavioral-verification assertReexportedFrom runs the graph rule over src/sale.ts, a middle barrel `export * as api from "./sale.js"`, and an entry `export type * from "./middle.js"`, and requires the entry's unacknowledged population to equal exactly api.IPlain, api.IPlain.rate and api.Sale.
 * @evidence contracts/testing.md#independent-expectations The expected list is an authored literal: the type-only star withholds the value members and the function under the namespace segment, while the namespace segment `api` is kept in each address.
 * @evidence contracts/testing.md#distinguishing-cases The type-only edge sits above a namespace re-export, so the test fails both if value members leak and if the segment is dropped from the address; the named and value-star shapes are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestATypeOnlyStarWithholdsThroughANamespaceReexportBelowIt is a Go unit entry in the native test process; assertReexportedFrom calls runIndexRule over temp fixture files and compares the Missing-acknowledgement targets, with no consumer install or product host.
 */
func TestATypeOnlyStarWithholdsThroughANamespaceReexportBelowIt(t *testing.T) {
  assertReexportedFrom(t, "type-only star over namespace", map[string]string{
    "src/sale.ts":   reexportedSurface,
    "src/middle.ts": "export * as api from \"./sale.js\";\n",
    "src/index.ts":  "export type * from \"./middle.js\";\n",
  }, "src/index.ts", []string{"api.IPlain", "api.IPlain.rate", "api.Sale"})
}
