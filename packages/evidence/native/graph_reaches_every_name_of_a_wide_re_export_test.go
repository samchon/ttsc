package evidence

import "testing"

/**
 * Verifies a barrel forwarding many names from one module reaches all of them.
 *
 * A wide `export { a, b, c, ... } from` is the ordinary shape of a generated
 * barrel. Walking the target once per specifier returns the same answer and
 * re-traverses its whole subtree for every name, so this pins the result while
 * the grouping keeps the cost linear.
 *
 *  1. Forward four names from one module through an entry.
 *  2. Acknowledge all four by their entry-relative addresses.
 *  3. Assert silence, so every forwarded name both resolved and was covered.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with the shared entry claim over an index `export { get, post, patch, erase } from "./operations.js"` and a view citing all four names as `{@link api.<name>}`; assertNoProblems requires an empty list.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the barrel contract: every name forwarded by one wide re-export must resolve and be covered by its entry-relative address.
 * @evidence contracts/testing.md#distinguishing-cases Four names forwarded from one module, all cited; a traversal that dropped a name would leave it owed, and one that failed to resolve a citation would report it. The linear-cost grouping is not measured here.
 * @evidence contracts/testing.md#execution-ownership TestGraphReachesEveryNameOfAWideReExport is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphReachesEveryNameOfAWideReExport(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/api/operations.ts": `
export function get(): void {}
export function post(): void {}
export function patch(): void {}
export function erase(): void {}
`,
    "src/api/index.ts": `
export { get, post, patch, erase } from "./operations.js";
`,
    "src/views/detail.ts": `
import type * as api from "./../api/index.js";

/**
 * @evidence {@link api.get} Reads the resource.
 * @evidence {@link api.post} Creates the resource.
 * @evidence {@link api.patch} Updates the resource.
 * @evidence {@link api.erase} Removes the resource.
 */
export function detail(): void {}
`,
  }, entryClaimConfig))
}
