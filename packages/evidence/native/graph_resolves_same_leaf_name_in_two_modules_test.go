package evidence

import "testing"

/**
 * TestGraphResolvesSameLeafNameInTwoModules verifies one leaf name in two modules, cited
 * from two files, resolves both times without ambiguity.
 *
 * A nestia-shaped SDK puts `get` in every resource module, and the old global
 * table reported every citation of either as ambiguous with no rename able to
 * fix it, because the collision is the intended shape of the API. Import-scope
 * resolution starts from a binding in one file, so the two never compete.
 *
 *  1. Declare `get` in two modules and cite each from its own view.
 *  2. Evaluate the graph.
 *  3. Assert silence and no ambiguity, then remove only the questions import and require its unimported-target diagnostic.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with the import-scope configuration over two modules each declaring `get`, cited from two views through `questions.get` and `reviews.get`; assertNoProblems requires an empty list and the diagnostics must contain no `Ambiguous evidence target`. Removing only the questions import must produce the literal unimported questions.get finding despite the remaining imported reviews.get.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the resolution contract: a generated SDK repeats leaf names in every resource module, and import-scope resolution starts from a binding in one file, so the two same-named units never compete.
 * @evidence contracts/testing.md#distinguishing-cases Two units with one leaf name cited from separate files; a repository-wide name table would report both citations ambiguous, which the explicit no-ambiguity check isolates from other failures. The unchanged reviews import is a negative control against treating any imported matching get as sufficient for questions.get.
 * @evidence contracts/testing.md#execution-ownership TestGraphResolvesSameLeafNameInTwoModules is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphResolvesSameLeafNameInTwoModules(t *testing.T) {
  files := map[string]string{
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
  }
  messages := runIndexRule(t, files, importScopeConfig)
  assertNoProblems(t, messages)
  if countProblemsContaining(messages, "Ambiguous evidence target") != 0 {
    t.Fatalf("the collision the issue exists for was reported as ambiguous")
  }
  files["src/views/question.ts"] = `
/** @evidence {@link questions.get} Renders the question operation. */
export function question(): void {}
`
  assertProblemContains(t, runIndexRule(t, files, importScopeConfig), "Unimported evidence target '{@link questions.get}'")
}
