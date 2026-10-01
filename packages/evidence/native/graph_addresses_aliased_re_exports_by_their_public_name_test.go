package evidence

import "testing"

/**
 * Verifies an aliased re-export is addressed by its public name.
 *
 * `export { get as fetch }` is what a consumer can import, so the accessor path
 * has to follow the alias. Addressing the declaring module's own name would
 * name something no importer can reach.
 *
 *  1. Re-export a callable under a different name.
 *  2. Cite the alias, and assert the original name is not addressable.
 *  3. Assert the alias resolves and the original does not.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over src/views/** and a TypeScript function reference over src/api/index.ts, where the index has `export { get as fetch }`; a citation `{@link api.fetch}` must give no diagnostics, and a citation `{@link api.get}` must report `declares no selected unit named 'get'`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the addressing contract: an importer can reach only the public alias, so the accessor path follows `fetch` and the declaring module's own name `get` names nothing reachable.
 * @evidence contracts/testing.md#distinguishing-cases The same files cited by the alias (resolves) and by the original name (refused); a resolver that addressed the declaring module's name would swap the two outcomes.
 * @evidence contracts/testing.md#execution-ownership TestGraphAddressesAliasedReExportsByTheirPublicName is a Go unit entry in the native test process; it calls the graph rule twice through runIndexRule over temp fixture files, with no consumer install or product host.
 */
func TestGraphAddressesAliasedReExportsByTheirPublicName(t *testing.T) {
  files := map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "src/api/index.ts":     "export { get as fetch } from \"./questions.js\";\n",
    "src/views/detail.ts": `
import type * as api from "./../api/index.js";

/** @evidence {@link api.fetch} Renders this operation's response. */
export function detail(): void {}
`,
  }
  assertNoProblems(t, runIndexRule(t, files, entryClaimConfig))

  files["src/views/detail.ts"] = `
import type * as api from "./../api/index.js";

/** @evidence {@link api.get} Renders this operation's response. */
export function detail(): void {}
`
  assertProblemContains(
    t,
    runIndexRule(t, files, entryClaimConfig),
    "declares no selected unit named 'get'",
  )
}
