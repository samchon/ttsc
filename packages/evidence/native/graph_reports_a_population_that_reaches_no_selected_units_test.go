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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a matched module exposing none of the selected kinds is reported. The original assertions check assert the empty population is reported rather than passing.
 * @evidence contracts/testing.md#independent-expectations The population resolved and is empty, which coverage would otherwise treat as complete. Naming the selector tells the author which half to correct. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Publish only a type while selecting callables. Evaluate the graph. Assert the empty population is reported rather than passing. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphReportsAPopulationThatReachesNoSelectedUnits is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
