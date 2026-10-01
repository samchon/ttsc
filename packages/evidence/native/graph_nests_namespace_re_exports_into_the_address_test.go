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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with the shared entry claim over an index `export * as functional` that forwards `export * as questions` of a module declaring `get`, with a view citing `{@link api.functional.questions.get}`; assertNoProblems requires an empty list.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the addressing contract: each `export * as ns` nests the target's surface one segment deeper, so the full accessor path `functional.questions.get` is the address that resolves; flattening would collapse the resource modules into one namespace.
 * @evidence contracts/testing.md#distinguishing-cases Two nested namespace hops cited by the full path; the flat and aliased address forms are owned by sibling entries. Silence shows the citation resolved and acknowledged the one function.
 * @evidence contracts/testing.md#execution-ownership TestGraphNestsNamespaceReExportsIntoTheAddress is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
