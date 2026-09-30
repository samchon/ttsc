package evidence

import "testing"

/**
 * Verifies an aliased import resolves under the exporting module's name.
 *
 * `import { get as fetchQuestion }` is cited as `fetchQuestion`, but the unit in
 * the other module is `get`. Resolving the local spelling would report a
 * perfectly valid citation as unreachable.
 *
 *  1. Import a callable under an alias and cite the alias.
 *  2. Evaluate the graph.
 *  3. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies an aliased import resolves under the exporting module's name. The original assertions check assert silence.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations `import { get as fetchQuestion }` is cited as `fetchQuestion`, but the unit in the other module is `get`. Resolving the local spelling would report a perfectly valid citation as unreachable. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Import a callable under an alias and cite the alias. Evaluate the graph. Assert silence. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphResolvesInlineLinkThroughAliasedImport is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphResolvesInlineLinkThroughAliasedImport(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "src/views/detail.ts": `
import type { get as fetchQuestion } from "./../api/questions.js";

/** @evidence {@link fetchQuestion} Renders this operation's response. */
export function detail(): void {}
`,
  }, importScopeConfig))
}
