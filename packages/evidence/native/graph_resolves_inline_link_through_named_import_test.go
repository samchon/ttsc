package evidence

import "testing"

/**
 * Verifies a named import resolves under the name it brings in.
 *
 * A named import contributes its own segment, unlike a namespace import, so the
 * two forms cannot share one code path without one of them resolving against
 * the wrong module member.
 *
 *  1. Import one callable by name and cite it.
 *  2. Evaluate the graph.
 *  3. Assert silence.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with the import-scope configuration over a view that imports `{ get }` from a module declaring `get` and cites `{@link get}`; assertNoProblems requires an empty list.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the resolution contract: a named import contributes its own segment (unlike a namespace import), so the citation `get` resolves to the imported unit and acknowledges it.
 * @evidence contracts/testing.md#distinguishing-cases A plain named import without alias; the aliased and namespace forms are owned by sibling entries, so a resolver that shared one code path across forms would fail one of the three.
 * @evidence contracts/testing.md#execution-ownership TestGraphResolvesInlineLinkThroughNamedImport is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphResolvesInlineLinkThroughNamedImport(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "src/views/detail.ts": `
import type { get } from "./../api/questions.js";

/** @evidence {@link get} Renders this operation's response. */
export function detail(): void {}
`,
  }, importScopeConfig))
}
