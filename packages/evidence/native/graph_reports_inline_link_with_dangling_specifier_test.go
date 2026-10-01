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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with the import-scope configuration over a view that imports `* as missing from "./../api/absent.js"` (no such module) and cites `{@link missing.get}`; assertProblemContains requires `Unresolved module './../api/absent.js'`.
 * @evidence contracts/testing.md#independent-expectations The expected message is authored from the diagnostic contract: the import exists but the module does not, which is repaired elsewhere than a missing import, so the message must name the specifier rather than fold into the unimported case.
 * @evidence contracts/testing.md#distinguishing-cases An import whose specifier resolves to no file, against the missing-import case in the sibling entry and the missing-member case in the unreachable-segment entry.
 * @evidence contracts/testing.md#execution-ownership TestGraphReportsInlineLinkWithDanglingSpecifier is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
