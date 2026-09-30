package evidence

import "testing"

/**
 * Verifies `export * as ns` nests the target's surface one segment deeper.
 *
 * This is the shape a generated SDK is built from, and it is the whole reason
 * `api.functional.questions.get` can be written at all. Flattening it would
 * collapse every resource module into one namespace and reintroduce the
 * collision the accessor path exists to avoid.
 *
 *  1. Nest two resource modules under namespace re-exports.
 *  2. Cite one operation by its full accessor path.
 *  3. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies `export * as ns` nests the target's surface one segment deeper. The original assertions check assert silence.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations This is the shape a generated SDK is built from, and it is the whole reason `api.functional.questions.get` can be written at all. Flattening it would collapse every resource module into one namespace and reintroduce the collision the accessor path exists to avoid. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Nest two resource modules under namespace re-exports. Cite one operation by its full accessor path. Assert silence. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphNestsNamespaceReExportsIntoTheAddress is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphNestsNamespaceReExportsIntoTheAddress(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "src/api/functional.ts": `
export * as questions from "./questions.js";
`,
    "src/api/index.ts": "export * as functional from \"./functional.js\";\n",
    "src/views/detail.ts": `
import type * as api from "./../api/index.js";

/** @evidence {@link api.functional.questions.get} Renders this operation's response. */
export function detail(): void {}
`,
  }, entryClaimConfig))
}
