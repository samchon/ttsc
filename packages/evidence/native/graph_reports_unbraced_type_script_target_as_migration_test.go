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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies an unbraced TypeScript target gets the migration diagnostic. The original assertions check assert the migration diagnostic spells the inline link form.
 * @evidence contracts/testing.md#independent-expectations The old spelling still resolves to a real unit, so a bare "unresolved" would be actively misleading — the target is correct and only its form is not. The message names the exact replacement, in the style the retired `sources` and `citedBy` properties already use. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Cite a real symbol without braces from a TypeScript claim. Evaluate the graph. Assert the migration diagnostic spells the inline link form. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphReportsUnbracedTypeScriptTargetAsMigration is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
