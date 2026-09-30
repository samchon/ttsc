package evidence

import "testing"

/**
 * Verifies a named import resolves under the name it brings in.
 *
 * A named import contributes its own segment, unlike a namespace import, so the
 * two forms cannot share one code path without one of them resolving against
 * the wrong module member.
 *
 *  1. Import one callable by name and cite it.
 *  2. Evaluate the graph.
 *  3. Assert silence.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a named import resolves under the name it brings in. The original assertions check assert silence.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A named import contributes its own segment, unlike a namespace import, so the two forms cannot share one code path without one of them resolving against the wrong module member. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Import one callable by name and cite it. Evaluate the graph. Assert silence. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphResolvesInlineLinkThroughNamedImport is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphResolvesInlineLinkThroughNamedImport(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "src/views/detail.ts": `
import type { get } from "./../api/questions.js";

/** @evidence {@link get} Renders this operation's response. */
export function detail(): void {}
`,
  }, importScopeConfig))
}
