package evidence

import (
  "testing"
)

/**
 * Verifies ambient claim hosts: an implicitly exported namespace function can
 * carry a function-scoped evidence declaration.
 *
 * Unit visibility and JSDoc host eligibility share the same public boundary.
 * Fixing only inventory materialization leaves the function visible as
 * evidence but unable to claim its own evidence.
 *
 *  1. Attach an evidence tag to one implicit ambient function.
 *  2. Select function hosts and one Markdown heading.
 *  3. Assert the complete graph accepts the declaration.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the complete graph accepts the declaration.
 * @evidence contracts/testing.md#independent-expectations Unit visibility and JSDoc host eligibility share the same public boundary. Fixing only inventory materialization leaves the function visible as evidence but unable to claim its own evidence. The authored scenario requires this outcome: Assert the complete graph accepts the declaration.
 * @evidence contracts/testing.md#distinguishing-cases Attach an evidence tag to one implicit ambient function. Select function hosts and one Markdown heading. Assert the complete graph accepts the declaration.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptAmbientNamespaceMembersAreClaimHosts runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptAmbientNamespaceMembersAreClaimHosts(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/contracts.d.ts": `
export namespace Ambient {
  /** @evidence docs/spec.md#contract This ambient API implements the contract. */
  function run(): void;
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/contracts.d.ts"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertNoProblems(t, messages)
}
