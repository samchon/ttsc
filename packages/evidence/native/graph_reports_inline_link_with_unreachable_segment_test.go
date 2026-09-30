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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a segment the module does not declare is reported as unreachable. The original assertions check assert the unreachable diagnostic names the module and the missing name.
 * @evidence contracts/testing.md#independent-expectations The import resolved and the module exists, so the repair is the target text or the reference selection — the diagnostic names both the module it landed in and the name it looked for, since neither is obvious from the citation. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Import a real module and cite a member it does not declare. Evaluate the graph. Assert the unreachable diagnostic names the module and the missing name. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphReportsInlineLinkWithUnreachableSegment is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
