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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a namespace import resolves an inline link target. The original assertions check assert no diagnostic at all, so both resolution and coverage succeeded.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations This is the shape the issue is written around: `import * as api` contributes no segment of its own, so `api.get` means `get` inside the resolved module. Getting that wrong shifts every segment by one and makes the flagship form unusable. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Import a module as a namespace and cite one of its callables. Evaluate the graph. Assert no diagnostic at all, so both resolution and coverage succeeded. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphResolvesInlineLinkThroughNamespaceImport is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
