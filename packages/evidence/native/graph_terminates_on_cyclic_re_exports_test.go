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
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with the shared entry claim over two barrels that star-export each other (one declaring `get`) and a view citing `{@link api.get}`; assertNoProblems requires an empty list, which requires the run to terminate.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the traversal contract: a cyclic barrel is a real shape in generated code, and an unguarded traversal would recurse without end, so the run must complete and still resolve and acknowledge `get`.
 * @evidence contracts/testing.md#distinguishing-cases A two-module cycle where one module holds the declaration; self-referential namespace cycles are owned by the file-link cycle entries. A hang would surface as a test timeout rather than an assertion.
 * @evidence contracts/testing.md#execution-ownership TestGraphTerminatesOnCyclicReExports is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
