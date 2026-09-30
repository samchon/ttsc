package evidence

import "testing"

/**
 * Verifies a citation without an import is reported as unimported.
 *
 * This is the defect the whole grammar exists to close: a target that names a
 * symbol the citing module never references is not a reference at all. The
 * diagnostic has to name `import type`, because that is the form which creates
 * no runtime edge.
 *
 *  1. Cite a symbol without importing it.
 *  2. Evaluate the graph.
 *  3. Assert the unimported diagnostic and its repair.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a citation without an import is reported as unimported. The original assertions check assert the unimported diagnostic and its repair.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations This is the defect the whole grammar exists to close: a target that names a symbol the citing module never references is not a reference at all. The diagnostic has to name `import type`, because that is the form which creates no runtime edge. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Cite a symbol without importing it. Evaluate the graph. Assert the unimported diagnostic and its repair. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphReportsInlineLinkWithoutImport is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphReportsInlineLinkWithoutImport(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "src/views/detail.ts": `
/** @evidence {@link questions.get} Renders this operation's response. */
export function detail(): void {}
`,
  }, importScopeConfig)
  assertProblemContains(t, messages, "Unimported evidence target '{@link questions.get}'")
  assertProblemContains(t, messages, "'import type' is enough")
}
