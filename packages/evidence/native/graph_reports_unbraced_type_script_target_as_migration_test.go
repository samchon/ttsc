package evidence

import "testing"

/**
 * Verifies an unbraced TypeScript target gets the migration diagnostic.
 *
 * The old spelling still resolves to a real unit, so a bare "unresolved" would
 * be actively misleading — the target is correct and only its form is not. The
 * message names the exact replacement, in the style the retired `sources` and
 * `citedBy` properties already use.
 *
 *  1. Cite a real symbol without braces from a TypeScript claim.
 *  2. Evaluate the graph.
 *  3. Assert the migration diagnostic spells the inline link form.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with the import-scope configuration over a view that cites the unbraced token `get`; the diagnostics must contain `Unbraced TypeScript evidence target 'get'` and `'@evidence {@link get} <reason>'`.
 * @evidence contracts/testing.md#independent-expectations The expected wording is authored from the migration contract: the old spelling names a real unit, so the message must say only its form is wrong and spell the exact braced replacement instead of reporting an unresolved target.
 * @evidence contracts/testing.md#distinguishing-cases An unbraced code target from a TypeScript claim; the Markdown path target that must not receive this diagnostic is owned by TestGraphKeepsMarkdownTargetsUnbraced.
 * @evidence contracts/testing.md#execution-ownership TestGraphReportsUnbracedTypeScriptTargetAsMigration is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphReportsUnbracedTypeScriptTargetAsMigration(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "src/views/detail.ts": `
import type * as questions from "./../api/questions.js";

/** @evidence get Renders this operation's response. */
export function detail(): void {}
`,
  }, importScopeConfig)
  assertProblemContains(t, messages, "Unbraced TypeScript evidence target 'get'")
  assertProblemContains(t, messages, "'@evidence {@link get} <reason>'")
}
