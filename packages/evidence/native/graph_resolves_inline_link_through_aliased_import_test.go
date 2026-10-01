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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with the import-scope configuration over a view that imports `{ get as fetchQuestion }` from a module declaring `get` and cites `{@link fetchQuestion}`; assertNoProblems requires an empty list.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the resolution contract: the citation uses the local alias while the unit lives under the exporting module's name `get`, so the alias must be resolved back to `get` rather than reported as unreachable.
 * @evidence contracts/testing.md#distinguishing-cases A named import with an alias; the plain named and namespace import forms are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestGraphResolvesInlineLinkThroughAliasedImport is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
