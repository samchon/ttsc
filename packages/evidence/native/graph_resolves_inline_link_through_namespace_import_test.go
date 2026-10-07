package evidence

import "testing"

/**
 * Verifies a namespace import resolves an inline link target.
 *
 * This is the shape the issue is written around: `import * as api` contributes
 * no segment of its own, so `api.get` means `get` inside the resolved module.
 * Getting that wrong shifts every segment by one and makes the flagship form
 * unusable.
 *
 *  1. Import a module as a namespace and cite one of its callables.
 *  2. Evaluate the graph.
 *  3. Assert no diagnostic at all, so both resolution and coverage succeeded.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with the import-scope configuration over a view that imports `* as questions` from a module declaring `get` and cites `{@link questions.get}`; assertNoProblems requires an empty list.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the resolution contract: a namespace import contributes no segment of its own, so `questions.get` means `get` inside the resolved module and both resolution and coverage must succeed.
 * @evidence contracts/testing.md#distinguishing-cases A namespace import with one qualified segment; an off-by-one segment shift would leave the citation unreachable or the callable owed, and the named and aliased forms are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestGraphResolvesInlineLinkThroughNamespaceImport is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphResolvesInlineLinkThroughNamespaceImport(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "src/views/detail.ts": `
import type * as questions from "./../api/questions.js";

/** @evidence {@link questions.get} Renders this operation's response. */
export function detail(): void {}
`,
  }, importScopeConfig))
}
