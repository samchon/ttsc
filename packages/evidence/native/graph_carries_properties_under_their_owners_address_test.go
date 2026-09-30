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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a property travels with the type that owns it. The original assertions check assert the property is covered by its owner's scope.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A property is addressable exactly when its owner is, so an entry that reaches `ISale` must also reach `ISale.price`. Materializing only the top-level declaration would silently drop every property obligation the moment a reference switched from globs to an entry. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Select type and property units through an entry. Acknowledge the owning type alone. Assert the property is covered by its owner's scope. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphCarriesPropertiesUnderTheirOwnersAddress is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
