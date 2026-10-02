package evidence

import "testing"

/**
 * Verifies a segment the module does not declare is reported as unreachable.
 *
 * The import resolved and the module exists, so the repair is the target text
 * or the reference selection — the diagnostic names both the module it landed
 * in and the name it looked for, since neither is obvious from the citation.
 *
 *  1. Import a real module and cite a member it does not declare.
 *  2. Evaluate the graph.
 *  3. Assert the unreachable diagnostic names the module and the missing name.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with the import-scope configuration over a view that imports a real module declaring only `get` and cites `{@link questions.erase}`; assertProblemContains requires `src/api/questions.ts' declares no selected unit named 'erase'`.
 * @evidence contracts/testing.md#independent-expectations The expected message is authored from the diagnostic contract: the import resolved and the module exists, so the repair is the target text or the reference selection and the message must name both the module reached and the name looked for.
 * @evidence contracts/testing.md#distinguishing-cases A real module with a member it does not declare; the unimported and dangling-specifier causes are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestGraphReportsInlineLinkWithUnreachableSegment is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphReportsInlineLinkWithUnreachableSegment(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "src/views/detail.ts": `
import type * as questions from "./../api/questions.js";

/** @evidence {@link questions.erase} Renders this operation's response. */
export function detail(): void {}
`,
  }, importScopeConfig)
  assertProblemContains(t, messages, "src/api/questions.ts' declares no selected unit named 'erase'")
}
