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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with the shared entry claim over an index `export * from "./questions.js"` (the declaring module is outside the entry glob) and a view citing `{@link api.get}`; assertNoProblems requires an empty list.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the population contract: a glob selects modules and the population is what they publish, so `get` belongs to the obligation through the barrel and is nameable by its barrel-relative address.
 * @evidence contracts/testing.md#distinguishing-cases A single star re-export cited by the flat address; a population that held only the barrel's own declarations would find the citation unresolved, and the nested namespace forms are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestGraphReachesSymbolsThroughStarReExports is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
