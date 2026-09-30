package evidence

import "testing"

/**
 * Verifies claim host scope: a resolvable declaration on an unselected
 * symbol kind does not satisfy coverage.
 *
 * Resolution and host eligibility are separate checks. Treating every JSDoc
 * tag in a matched file as valid would make a property-only claim selector
 * indistinguishable from the all-symbol default.
 *
 *  1. Select only TypeScript property hosts and materialize one such host.
 *  2. Put a valid target on a neighboring exported function.
 *  3. Assert both the out-of-scope host and missing acknowledgement.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies claim host scope: a resolvable declaration on an unselected symbol kind does not satisfy coverage. The original assertions check assert both the out-of-scope host and missing acknowledgement.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Resolution and host eligibility are separate checks. Treating every JSDoc tag in a matched file as valid would make a property-only claim selector indistinguishable from the all-symbol default. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Select only TypeScript property hosts and materialize one such host. Put a valid target on a neighboring exported function. Assert both the out-of-scope host and missing acknowledgement. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDeclarationsRejectOutOfScopeSymbolHosts is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDeclarationsRejectOutOfScopeSymbolHosts(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/ref.ts": `
/** @evidence docs/spec.md#contract This function is outside the selected host kind. */
export function ref(): void {}
export const selectedProperty = true;
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ref.ts"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "Out-of-scope @evidence host")
  assertProblemContains(t, messages, "host kind 'function' is not selected")
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#contract'")
}
