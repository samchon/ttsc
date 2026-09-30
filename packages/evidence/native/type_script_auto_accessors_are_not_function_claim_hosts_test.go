package evidence

import (
  "testing"
)

/**
 * Verifies auto-accessor claim hosts: JSDoc on an accessor stays outside a
 * function-only claim even when its initializer is callable.
 *
 * Excluding only the source unit is insufficient because supported-host
 * collection can still accept the same declaration as an outgoing function
 * claim.
 *
 *  1. Attach evidence to a callable auto-accessor beside a real function unit.
 *  2. Select function hosts and one Markdown heading.
 *  3. Assert the declaration is reported as unsupported.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the declaration is reported as unsupported.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Excluding only the source unit is insufficient because supported-host collection can still accept the same declaration as an outgoing function claim. The authored scenario requires this outcome: Assert the declaration is reported as unsupported.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Attach evidence to a callable auto-accessor beside a real function unit. Select function hosts and one Markdown heading. Assert the declaration is reported as unsupported.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTypeScriptAutoAccessorsAreNotFunctionClaimHosts runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptAutoAccessorsAreNotFunctionClaimHosts(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/contracts.ts": `
export class Service {
  /** @evidence docs/spec.md#contract This accessor cannot claim function evidence. */
  accessor callback = (): void => {};
  handler = (): void => {};
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/contracts.ts"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "unsupported or non-exported declaration")
}
