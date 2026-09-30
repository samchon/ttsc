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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies several selected modules union into one population. The original assertions check assert each citation alone resolves and completes the obligation.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A glob usually matches a barrel and the modules beneath it at once. Each is a module a consumer may import, so the symbol is citable through either — and the two ways of reaching one declaration must still leave one obligation, or selecting a directory would demand a second citation for every re-export. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Match both a barrel and the module it forwards. Cite the declaration through the barrel, then through the declaring module. Assert each citation alone resolves and completes the obligation. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphUnionsSeveralSelectedModules is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
