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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a symbol an entry exposes twice remains one coverage unit. The original assertions check assert silence, so the other address created no second obligation.
 * @evidence contracts/testing.md#independent-expectations Both addresses have to resolve, because both are real to an importer, and neither may create a second obligation — a barrel that also re-exports a namespace would otherwise double every symbol underneath it and demand two citations for one contract. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Expose one declaration flat and under a namespace from the same entry. Acknowledge its one coverage obligation through either address. Assert silence, so the other address created no second obligation. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphCountsATwiceReachedSymbolOnce is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
