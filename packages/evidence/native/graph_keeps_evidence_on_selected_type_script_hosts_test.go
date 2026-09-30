package evidence

import "testing"

/**
 * Verifies ownership evidence remains bound to the symbol selector even when
 * the same public export is an eligible exclusion carrier.
 *
 * The carrier exception expresses non-applicability only. Letting `@evidence`
 * use it would move claimed implementation away from the declaration that
 * actually owns the behavior and erase the graph's host meaning.
 *
 *  1. Select a function host and cite the target from an exported property.
 *  2. Use `@evidence`, not `@evidenceExclude`, on that carrier.
 *  3. Assert the selected-host diagnostic and missing obligation both remain.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies ownership evidence remains bound to the symbol selector even when the same public export is an eligible exclusion carrier. The original assertions check assert the selected-host diagnostic and missing obligation both remain.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The carrier exception expresses non-applicability only. Letting `@evidence` use it would move claimed implementation away from the declaration that actually owns the behavior and erase the graph's host meaning. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Select a function host and cite the target from an exported property. Use `@evidence`, not `@evidenceExclude`, on that carrier. Assert the selected-host diagnostic and missing obligation both remain. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphKeepsEvidenceOnSelectedTypeScriptHosts is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphKeepsEvidenceOnSelectedTypeScriptHosts(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/controllers/CONTROLLER_EVIDENCE_EXCLUDE.ts": `
/**
 * Central controller exclusions.
 *
 * @evidence docs/spec.md#contract This property does not own an operation.
 */
export const CONTROLLER_EVIDENCE_EXCLUDE = true;
export function selectedController(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/controllers/**/*.ts"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "Out-of-scope @evidence host")
  assertProblemContains(t, messages, "host kind 'property' is not selected")
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#contract'")
}
