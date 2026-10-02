package evidence

import (
  "testing"
)

/**
 * Verifies namespace and variable claim hosts: their JSDoc declarations are
 * accepted by the type and property selectors respectively.
 *
 * Materializing a target without making its declaration a legal claim host
 * creates a one-way graph surface. The two claims prove both new kinds can own
 * outgoing evidence edges through the complete rule.
 *
 *  1. Cite one Markdown section from an exported namespace and one variable.
 *  2. Select the matching host kind in two independent claims.
 *  3. Assert both graphs are complete.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert both graphs are complete.
 * @evidence contracts/testing.md#independent-expectations Materializing a target without making its declaration a legal claim host creates a one-way graph surface. The two claims prove both new kinds can own outgoing evidence edges through the complete rule. The authored scenario requires this outcome: Assert both graphs are complete.
 * @evidence contracts/testing.md#distinguishing-cases Cite one Markdown section from an exported namespace and one variable. Select the matching host kind in two independent claims. Assert both graphs are complete.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptNamespaceAndVariableDeclarationsAreClaimHosts runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptNamespaceAndVariableDeclarationsAreClaimHosts(t *testing.T) {
  files := map[string]string{
    "docs/namespace.md": "## Namespace\n",
    "docs/property.md":  "## Property\n",
    "src/namespace.ts": `
/** @evidence docs/namespace.md#namespace The namespace owns this contract. */
export namespace Api {}
`,
    "src/property.ts": `
/** @evidence docs/property.md#property This value exposes the documented state. */
export const state = "ready";
`,
  }
  config := `{"claims":[
    {
      "type":"typescript",
      "files":["src/namespace.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/namespace.md"],"symbol":"h2"}
    },
    {
      "type":"typescript",
      "files":["src/property.ts"],
      "symbol":"property",
      "reference":{"type":"markdown","files":["docs/property.md"],"symbol":"h2"}
    }
  ]}`
  assertNoProblems(t, runIndexRule(t, files, config))
}
