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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over src/views/** and the `@org/api` package reference (main pointing at lib/index.js, types condition at lib/index.d.ts), where a view cites `{@link api.get}`; assertNoProblems requires an empty list.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the entry-resolution contract: `main` names the JavaScript a consumer runs while a citation addresses declarations, so the `types` condition supplies the entry; following `main` would resolve to a file with no declarations.
 * @evidence contracts/testing.md#distinguishing-cases Both a JavaScript file and a declaration file exist for `get`; silence requires `get` to be found in the declarations and cited, and an empty population from `main` would also be silent, so the sibling bare-types entry (which asserts an owed diagnostic) is the control that a population is read at all.
 * @evidence contracts/testing.md#execution-ownership TestGraphReadsThePackageEntryFromItsTypesCondition is a Go unit entry in the native test process; runIndexRule writes the fixtures (including a node_modules package) to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
