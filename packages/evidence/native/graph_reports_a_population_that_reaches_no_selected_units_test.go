package evidence

import "testing"

/**
 * Verifies a matched module exposing none of the selected kinds is reported.
 *
 * The population resolved and is empty, which coverage would otherwise treat as
 * complete. Naming the selector tells the author which half to correct.
 *
 *  1. Publish only a type while selecting callables.
 *  2. Evaluate the graph.
 *  3. Assert the empty population is reported rather than passing.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with the shared entry claim (function reference over src/api/index.ts) where the entry re-exports a module declaring only `interface ISale`; assertProblemContains requires `matched 1 file(s) but found no selected evidence units (function)`.
 * @evidence contracts/testing.md#independent-expectations The expected message is authored from the population contract: a resolved population with none of the selected kinds is empty, which coverage would treat as complete, so the selector must be named to tell the author which half to fix.
 * @evidence contracts/testing.md#distinguishing-cases A matched module exposing only a type while the selector asks for callables; a matched module with a selected kind (owed units) and an unmatched glob are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestGraphReportsAPopulationThatReachesNoSelectedUnits is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphReportsAPopulationThatReachesNoSelectedUnits(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "src/api/sale.ts": `
export interface ISale {
  price: number;
}
`,
    "src/api/index.ts":    "export * from \"./sale.js\";\n",
    "src/views/detail.ts": "export function detail(): void {}\n",
  }, entryClaimConfig), "matched 1 file(s) but found no selected evidence units (function)")
}
