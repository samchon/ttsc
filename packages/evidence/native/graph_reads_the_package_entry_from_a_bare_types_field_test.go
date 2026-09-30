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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a bare `types` field is honored when there is no exports map. The original assertions check assert its symbol is demanded.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Older packages ship exactly this shape, and a resolver that only understood `exports` would silently reach nothing for them. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Publish a package whose manifest carries only `types`. Select it as evidence. Assert its symbol is demanded. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphReadsThePackageEntryFromABareTypesField is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
