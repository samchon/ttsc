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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with the import-scope configuration over a view that cites `{@link questions.get}` without importing `questions`; the diagnostics must contain `Unimported evidence target '{@link questions.get}'` and `'import type' is enough`.
 * @evidence contracts/testing.md#independent-expectations The expected wording is authored from the grammar contract: a target naming a symbol the citing module never references is not a reference, and the repair must name `import type`, the form that creates no runtime edge.
 * @evidence contracts/testing.md#distinguishing-cases A citation with no import at all; the dangling-specifier and unreachable-segment causes, which have an import, are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestGraphReportsInlineLinkWithoutImport is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
