package evidence

import "testing"

/**
 * Verifies a symbol an entry exposes twice remains one coverage unit.
 *
 * Both addresses have to resolve, because both are real to an importer, and
 * neither may create a second obligation — a barrel that also re-exports a
 * namespace would otherwise double every symbol underneath it and demand two
 * citations for one contract.
 *
 *  1. Expose one declaration flat and under a namespace from the same entry.
 *  2. Acknowledge its one coverage obligation through either address.
 *  3. Assert silence, so the other address created no second obligation.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with the shared entry claim (function claim over src/views/**, function reference over src/api/index.ts) where the index has both `export * from "./questions.js"` and `export * as questions from "./questions.js"`; a citation `{@link api.get}` and then a citation `{@link api.questions.get}` must each give no diagnostics.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the coverage contract: both addresses are real to an importer and must resolve, and a symbol reached twice remains one coverage unit, so neither citation leaves a second obligation owed.
 * @evidence contracts/testing.md#distinguishing-cases The flat and the namespace-qualified address of one function, each cited alone; if the namespace re-export doubled the unit, either single citation would leave a missing acknowledgement.
 * @evidence contracts/testing.md#execution-ownership TestGraphCountsATwiceReachedSymbolOnce is a Go unit entry in the native test process; it calls the graph rule twice through runIndexRule over temp fixture files, with no consumer install or product host.
 */
func TestGraphCountsATwiceReachedSymbolOnce(t *testing.T) {
  files := map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "src/api/index.ts": `
export * from "./questions.js";
export * as questions from "./questions.js";
`,
    "src/views/detail.ts": `
import type * as api from "./../api/index.js";

/** @evidence {@link api.get} Renders this operation's response. */
export function detail(): void {}
`,
  }
  assertNoProblems(t, runIndexRule(t, files, entryClaimConfig))

  files["src/views/detail.ts"] = `
import type * as api from "./../api/index.js";

/** @evidence {@link api.questions.get} Renders this operation's response. */
export function detail(): void {}
`
  assertNoProblems(t, runIndexRule(t, files, entryClaimConfig))
}
