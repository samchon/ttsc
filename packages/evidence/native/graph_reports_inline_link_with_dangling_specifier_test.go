package evidence

import "testing"

/**
 * Verifies a specifier that resolves to nothing is reported as such.
 *
 * One property away from the unimported case, and repaired somewhere else
 * entirely: the import exists, the module does not. Folding both into one
 * message would send the author to the wrong file.
 *
 *  1. Import from a module that does not exist and cite through it.
 *  2. Evaluate the graph.
 *  3. Assert the unresolved-module diagnostic names the specifier.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a specifier that resolves to nothing is reported as such. The original assertions check assert the unresolved-module diagnostic names the specifier.
 * @evidence contracts/testing.md#independent-expectations One property away from the unimported case, and repaired somewhere else entirely: the import exists, the module does not. Folding both into one message would send the author to the wrong file. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Import from a module that does not exist and cite through it. Evaluate the graph. Assert the unresolved-module diagnostic names the specifier. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphReportsInlineLinkWithDanglingSpecifier is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphReportsInlineLinkWithDanglingSpecifier(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "src/views/detail.ts": `
import type * as missing from "./../api/absent.js";

/** @evidence {@link missing.get} Renders this operation's response. */
export function detail(): void {}
`,
  }, importScopeConfig)
  assertProblemContains(t, messages, "Unresolved module './../api/absent.js'")
}
