package evidence

import "testing"

/**
 * Verifies a cyclic barrel terminates.
 *
 * Two modules re-exporting each other is a real shape in generated code, and an
 * unguarded traversal would recurse until the process died. A rule that hangs
 * is worse than one that reports nothing, because nothing else in the build
 * gets to run either.
 *
 *  1. Point two barrels at each other, one of them declaring a symbol.
 *  2. Cite that symbol through the entry.
 *  3. Assert the run completes and resolves.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a cyclic barrel terminates. The original assertions check assert the run completes and resolves.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Two modules re-exporting each other is a real shape in generated code, and an unguarded traversal would recurse until the process died. A rule that hangs is worse than one that reports nothing, because nothing else in the build gets to run either. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Point two barrels at each other, one of them declaring a symbol. Cite that symbol through the entry. Assert the run completes and resolves. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphTerminatesOnCyclicReExports is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphTerminatesOnCyclicReExports(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/api/index.ts": `
export * from "./other.js";
export function get(): void {}
`,
    "src/api/other.ts": "export * from \"./index.js\";\n",
    "src/views/detail.ts": `
import type * as api from "./../api/index.js";

/** @evidence {@link api.get} Renders this operation's response. */
export function detail(): void {}
`,
  }, entryClaimConfig))
}
