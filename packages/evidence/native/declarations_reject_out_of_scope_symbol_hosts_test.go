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
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a property claim over a file holding a documented exported function (carrying `@evidence docs/spec.md#contract`) and `export const selectedProperty = true`; the test requires `Out-of-scope @evidence host`, `host kind 'function' is not selected` and `Missing acknowledgement for 'docs/spec.md#contract'`.
 * @evidence contracts/testing.md#independent-expectations The expected diagnostics are authored from the host-eligibility contract: resolution and host eligibility are separate checks, so a resolvable citation on an unselected symbol kind must be reported and must not satisfy coverage.
 * @evidence contracts/testing.md#distinguishing-cases The neighboring selected property keeps the claim active while the cited function is the out-of-scope host; the three assertions check refusal and the unmet obligation together, only by containment.
 * @evidence contracts/testing.md#execution-ownership TestDeclarationsRejectOutOfScopeSymbolHosts is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
