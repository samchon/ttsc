package evidence

import "testing"

/**
 * Verifies several selected modules union into one population.
 *
 * A glob usually matches a barrel and the modules beneath it at once. Each is a
 * module a consumer may import, so the symbol is citable through either — and
 * the two ways of reaching one declaration must still leave one obligation, or
 * selecting a directory would demand a second citation for every re-export.
 *
 *  1. Match both a barrel and the module it forwards.
 *  2. Cite the declaration through the barrel, then through the declaring module.
 *  3. Assert each citation alone resolves and completes the obligation.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over src/views/** and a function reference over src/api/** (which matches both a barrel `export * from "./questions.js"` and the declaring module); a view citing `{@link api.get}` through the barrel and then a view citing `{@link questions.get}` through the declaring module must each give no diagnostics.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the population contract: a glob that matches a barrel and the modules beneath it makes the symbol citable through either, and the two paths to one declaration must leave one obligation, so each citation alone must complete it.
 * @evidence contracts/testing.md#distinguishing-cases The same files cited through each of the two reachable modules; if the two paths created two obligations, either single citation would leave one owed.
 * @evidence contracts/testing.md#execution-ownership TestGraphUnionsSeveralSelectedModules is a Go unit entry in the native test process; it calls the graph rule twice through runIndexRule over temp fixture files, with no consumer install or product host.
 */
func TestGraphUnionsSeveralSelectedModules(t *testing.T) {
  const config = `{"claims":[{
    "type":"typescript",
    "files":["src/views/**"],
    "symbol":"function",
    "reference":{"type":"typescript","files":["src/api/**"],"symbol":"function"}
  }]}`
  files := map[string]string{
    "src/api/questions.ts": "export function get(): void {}\n",
    "src/api/index.ts":     "export * from \"./questions.js\";\n",
    "src/views/detail.ts": `
import type * as api from "./../api/index.js";

/** @evidence {@link api.get} Renders this operation's response. */
export function detail(): void {}
`,
  }
  assertNoProblems(t, runIndexRule(t, files, config))

  files["src/views/detail.ts"] = `
import type * as questions from "./../api/questions.js";

/** @evidence {@link questions.get} Renders this operation's response. */
export function detail(): void {}
`
  assertNoProblems(t, runIndexRule(t, files, config))
}
