package evidence

import "testing"

/**
 * Verifies a selected module keeps every declaration it exposes as an
 * obligation.
 *
 * Selecting modules rather than declarations is only safe if the two agree on
 * what a module publishes. A declaration exposed under another name is
 * inventoried under the name it is exposed as, so matching it by the local
 * binding it wrote would drop it from the population — and an obligation that
 * disappears reads exactly like one that was discharged.
 *
 *  1. Expose a declaration under a different public name.
 *  2. Select the module and cite the ordinary declaration beside it.
 *  3. Assert the renamed declaration is still owed and is citable by that name.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a type claim over src/ledger.ts and a reference over src/contracts.ts selecting type and property, where the module has `interface IShape` and `const local` exported as `renamed`; citing only `{@link IShape}` must report `Missing acknowledgement for 'renamed'`, and also citing `{@link renamed}` must give no diagnostics.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the population contract: a declaration exposed under another public name is inventoried under that name, so it must stay owed until cited by the exposed name and an obligation must not vanish because its local binding differs.
 * @evidence contracts/testing.md#distinguishing-cases The uncited and cited runs over the same module differ only by the citation of the renamed export, so the missing-acknowledgement and clean outcomes pin that the renamed unit exists and is citable.
 * @evidence contracts/testing.md#execution-ownership TestGraphKeepsRenamedLocalExportsInThePopulation is a Go unit entry in the native test process; it calls the graph rule twice through runIndexRule over temp fixture files, with no consumer install or product host.
 */
func TestGraphKeepsRenamedLocalExportsInThePopulation(t *testing.T) {
  const config = `{"claims":[{
    "type":"typescript",
    "files":["src/ledger.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/contracts.ts"],"symbol":["type","property"]}
  }]}`
  const contracts = `export interface IShape {}
const local: number = 1;
export { local as renamed };
`
  uncited := runIndexRule(t, map[string]string{
    "src/contracts.ts": contracts,
    "src/ledger.ts": `import type { IShape } from "./contracts";

/** @evidence {@link IShape} Mirrors the shape contract. */
export interface ILedger {}
`,
  }, config)
  assertProblemContains(t, uncited, "Missing acknowledgement for 'renamed'")

  cited := runIndexRule(t, map[string]string{
    "src/contracts.ts": contracts,
    "src/ledger.ts": `import type { IShape } from "./contracts";
import { renamed } from "./contracts";

/**
 * @evidence {@link IShape} Mirrors the shape contract.
 * @evidence {@link renamed} Mirrors the renamed constant.
 */
export interface ILedger {}
`,
  }, config)
  assertNoProblems(t, cited)
}
