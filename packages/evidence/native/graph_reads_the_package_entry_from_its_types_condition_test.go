package evidence

import "testing"

/**
 * Verifies the package entry comes from the `types` condition, not from `main`.
 *
 * `main` names the JavaScript a consumer runs; a citation addresses
 * declarations. Following `main` would resolve to a file with no types at all
 * and report an empty population as a satisfied obligation.
 *
 *  1. Point `main` at a JavaScript file and `types` at the declarations.
 *  2. Select the package and acknowledge what its declarations expose.
 *  3. Assert silence, which is only reachable through the `types` condition.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies the package entry comes from the `types` condition, not from `main`. The original assertions check assert silence, which is only reachable through the `types` condition.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations `main` names the JavaScript a consumer runs; a citation addresses declarations. Following `main` would resolve to a file with no types at all and report an empty population as a satisfied obligation. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Point `main` at a JavaScript file and `types` at the declarations. Select the package and acknowledge what its declarations expose. Assert silence, which is only reachable through the `types` condition. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphReadsThePackageEntryFromItsTypesCondition is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphReadsThePackageEntryFromItsTypesCondition(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "node_modules/@org/api/package.json":   packageManifest,
    "node_modules/@org/api/lib/index.js":   "export function get() {}\n",
    "node_modules/@org/api/lib/index.d.ts": "export declare function get(): void;\n",
    "src/views/detail.ts": `
import type * as api from "@org/api";

/** @evidence {@link api.get} Renders this operation's response. */
export function detail(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/views/**"],
    "symbol":"function",
    "reference":{"type":"typescript","package":"@org/api","symbol":"function"}
  }]}`))
}
