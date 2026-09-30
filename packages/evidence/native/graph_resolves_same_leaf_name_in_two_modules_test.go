package evidence

import "testing"

/**
 * Verifies the motivating defect is gone: one leaf name in two modules, cited
 * from two files, resolves both times without ambiguity.
 *
 * A nestia-shaped SDK puts `get` in every resource module, and the old global
 * table reported every citation of either as ambiguous with no rename able to
 * fix it, because the collision is the intended shape of the API. Import-scope
 * resolution starts from a binding in one file, so the two never compete.
 *
 *  1. Declare `get` in two modules and cite each from its own view.
 *  2. Evaluate the graph.
 *  3. Assert silence, and specifically no ambiguity diagnostic.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies the motivating defect is gone: one leaf name in two modules, cited from two files, resolves both times without ambiguity. The original assertions check assert silence, and specifically no ambiguity diagnostic.
 * @evidence contracts/testing.md#independent-expectations A nestia-shaped SDK puts `get` in every resource module, and the old global table reported every citation of either as ambiguous with no rename able to fix it, because the collision is the intended shape of the API. Import-scope resolution starts from a binding in one file, so the two never compete. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Declare `get` in two modules and cite each from its own view. Evaluate the graph. Assert silence, and specifically no ambiguity diagnostic. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphResolvesSameLeafNameInTwoModules is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphResolvesSameLeafNameInTwoModules(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "src/api/reviews.ts":   "export function get(): void {}\n",
    "src/views/question.ts": `
import type * as questions from "./../api/questions.js";

/** @evidence {@link questions.get} Renders the question operation. */
export function question(): void {}
`,
    "src/views/review.ts": `
import type * as reviews from "./../api/reviews.js";

/** @evidence {@link reviews.get} Renders the review operation. */
export function review(): void {}
`,
  }, importScopeConfig)
  assertNoProblems(t, messages)
  if countProblemsContaining(messages, "Ambiguous evidence target") != 0 {
    t.Fatalf("the collision the issue exists for was reported as ambiguous")
  }
}
