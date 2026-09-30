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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies an aliased re-export is addressed by its public name. The original assertions check assert the alias resolves and the original does not.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations `export { get as fetch }` is what a consumer can import, so the accessor path has to follow the alias. Addressing the declaring module's own name would name something no importer can reach. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Re-export a callable under a different name. Cite the alias, and assert the original name is not addressable. Assert the alias resolves and the original does not. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphAddressesAliasedReExportsByTheirPublicName is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
