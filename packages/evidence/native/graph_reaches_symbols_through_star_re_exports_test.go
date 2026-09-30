package evidence

import "testing"

/**
 * Verifies a matched module reaches a symbol through `export *` and addresses it
 * by its accessor path.
 *
 * A glob selects modules, and the population is what those modules publish
 * rather than what they happen to declare. The declaring file here is outside
 * the glob, so the symbol belongs to the obligation only through the barrel —
 * and the accessor address is what makes it nameable at all.
 *
 *  1. Re-export a module's whole surface from a matched barrel.
 *  2. Cite the symbol under the barrel-relative address.
 *  3. Assert silence, which requires both resolution and coverage to succeed.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a matched module reaches a symbol through `export *` and addresses it by its accessor path. The original assertions check assert silence, which requires both resolution and coverage to succeed.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A glob selects modules, and the population is what those modules publish rather than what they happen to declare. The declaring file here is outside the glob, so the symbol belongs to the obligation only through the barrel — and the accessor address is what makes it nameable at all. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Re-export a module's whole surface from a matched barrel. Cite the symbol under the barrel-relative address. Assert silence, which requires both resolution and coverage to succeed. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphReachesSymbolsThroughStarReExports is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphReachesSymbolsThroughStarReExports(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "src/api/index.ts":     "export * from \"./questions.js\";\n",
    "src/views/detail.ts": `
import type * as api from "./../api/index.js";

/** @evidence {@link api.get} Renders this operation's response. */
export function detail(): void {}
`,
  }, entryClaimConfig))
}
