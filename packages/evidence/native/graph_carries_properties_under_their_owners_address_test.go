package evidence

import "testing"

/**
 * Verifies a property travels with the type that owns it.
 *
 * A property is addressable exactly when its owner is, so an entry that reaches
 * `ISale` must also reach `ISale.price`. Materializing only the top-level
 * declaration would silently drop every property obligation the moment a
 * reference switched from globs to an entry.
 *
 *  1. Select type and property units through an entry.
 *  2. Acknowledge the owning type alone.
 *  3. Assert the property is covered by its owner's scope.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over src/views/** and a TypeScript reference over src/api/index.ts selecting type and property units, where the index star-exports `interface ISale { price }` and a function cites `{@link api.ISale}`; assertNoProblems requires an empty list.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the unit-model contract: a property is addressable exactly when its owner is, and a citation of the owning type acknowledges its properties, so no property obligation is left owed when the reference switches from globs to an entry.
 * @evidence contracts/testing.md#distinguishing-cases One owner with one property reached through an entry; if the property were not materialized under the owner there would be no obligation, and if it were materialized but not covered by the owner's scope a missing-acknowledgement diagnostic would appear. Only the covered outcome is asserted.
 * @evidence contracts/testing.md#execution-ownership TestGraphCarriesPropertiesUnderTheirOwnersAddress is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphCarriesPropertiesUnderTheirOwnersAddress(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/api/sale.ts": `
export interface ISale {
  price: number;
}
`,
    "src/api/index.ts": "export * from \"./sale.js\";\n",
    "src/views/detail.ts": `
import type * as api from "./../api/index.js";

/** @evidence {@link api.ISale} Mirrors the sale contract and its properties. */
export function detail(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/views/**"],
    "symbol":"function",
    "reference":{"type":"typescript","files":["src/api/index.ts"],"symbol":["type","property"]}
  }]}`))
}
