package evidence

import "testing"

/**
 * Verifies a bare `types` field is honored when there is no exports map.
 *
 * Older packages ship exactly this shape, and a resolver that only understood
 * `exports` would silently reach nothing for them.
 *
 *  1. Publish a package whose manifest carries only `types`.
 *  2. Select it as evidence.
 *  3. Assert its symbol is demanded.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over src/views/** and a package reference `legacy-api` whose manifest holds only `types: ./index.d.ts` (no exports map), declaring `get`; assertProblemContains requires `Missing acknowledgement for 'get'`.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the entry-resolution contract: a bare `types` field is a valid entry for older packages, so its declared function must be owed when uncited rather than the population being empty.
 * @evidence contracts/testing.md#distinguishing-cases A manifest with `types` and no `exports`; the `types` condition inside an exports map is owned by the sibling entry, and a resolver that understood only `exports` would report nothing.
 * @evidence contracts/testing.md#execution-ownership TestGraphReadsThePackageEntryFromABareTypesField is a Go unit entry in the native test process; runIndexRule writes the fixtures (including a node_modules package) to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphReadsThePackageEntryFromABareTypesField(t *testing.T) {
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "node_modules/legacy-api/package.json": `{"name":"legacy-api","types":"./index.d.ts"}`,
    "node_modules/legacy-api/index.d.ts":   "export declare function get(): void;\n",
    "src/views/detail.ts":                  "export function detail(): void {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/views/**"],
    "symbol":"function",
    "reference":{"type":"typescript","package":"legacy-api","symbol":"function"}
  }]}`), "Missing acknowledgement for 'get'")
}
