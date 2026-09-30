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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a barrel forwarding many names from one module reaches all of them. The original assertions check assert silence, so every forwarded name both resolved and was covered.
 * @evidence contracts/testing.md#independent-expectations A wide `export { a, b, c, ... } from` is the ordinary shape of a generated barrel. Walking the target once per specifier returns the same answer and re-traverses its whole subtree for every name, so this pins the result while the grouping keeps the cost linear. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Forward four names from one module through an entry. Acknowledge all four by their entry-relative addresses. Assert silence, so every forwarded name both resolved and was covered. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestGraphReachesEveryNameOfAWideReExport is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
