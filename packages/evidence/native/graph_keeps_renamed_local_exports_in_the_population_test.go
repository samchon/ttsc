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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a selected module keeps every declaration it exposes as an obligation. The original assertions check assert the renamed declaration is still owed and is citable by that name.
 * @evidence contracts/testing.md#independent-expectations Selecting modules rather than declarations is only safe if the two agree on what a module publishes. A declaration exposed under another name is inventoried under the name it is exposed as, so matching it by the local binding it wrote would drop it from the population — and an obligation that disappears reads exactly like one that was discharged. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Expose a declaration under a different public name. Select the module and cite the ordinary declaration beside it. Assert the renamed declaration is still owed and is citable by that name. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphKeepsRenamedLocalExportsInThePopulation is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
