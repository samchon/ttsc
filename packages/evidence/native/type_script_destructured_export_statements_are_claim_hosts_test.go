package evidence

import (
  "testing"
)

/**
 * Verifies destructured claim hosts: statement JSDoc remains eligible for the
 * property bindings resident in an exported pattern.
 *
 * TypeScript attaches leading JSDoc to the variable statement wrapper, while
 * public identities live on nested binding elements. Both nodes must receive
 * the same property-host result.
 *
 *  1. Attach evidence to an exported object binding pattern.
 *  2. Select property hosts and one Markdown heading.
 *  3. Assert the complete rule accepts the host.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the complete rule accepts the host.
 * @evidence contracts/testing.md#independent-expectations TypeScript attaches leading JSDoc to the variable statement wrapper, while public identities live on nested binding elements. Both nodes must receive the same property-host result. The authored scenario requires this outcome: Assert the complete rule accepts the host.
 * @evidence contracts/testing.md#distinguishing-cases Attach evidence to an exported object binding pattern. Select property hosts and one Markdown heading. Assert the complete rule accepts the host.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptDestructuredExportStatementsAreClaimHosts runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptDestructuredExportStatementsAreClaimHosts(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Contract\n",
    "src/contracts.ts": `
const source = { state: "ready" };
/** @evidence docs/spec.md#contract This binding exposes the contract state. */
export const { state } = source;
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/contracts.ts"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertNoProblems(t, messages)
}
