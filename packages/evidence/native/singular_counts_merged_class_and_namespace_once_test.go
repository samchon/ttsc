package evidence

import (
  "testing"
)

/**
 * Verifies identity counting across declaration spaces: a class merged with a
 * namespace of the same name is one identity.
 *
 * A class occupies both the type and value space, so a counter keyed on
 * declaration kind rather than on name would double it the moment a namespace
 * joins.
 *
 *  1. Declare an exported class and its companion namespace.
 *  2. Run the rule against a file named after them.
 *  3. Assert silence.
 * @evidence contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert silence.
 * @evidence contracts/testing.md#independent-expectations A class occupies both the type and value space, so a counter keyed on declaration kind rather than on name would double it the moment a namespace joins. The authored scenario requires this outcome: Assert silence.
 * @evidence contracts/testing.md#distinguishing-cases Declare an exported class and its companion namespace. Run the rule against a file named after them. Assert silence.
 * @evidence contracts/testing.md#execution-ownership TestSingularCountsMergedClassAndNamespaceOnce runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularCountsMergedClassAndNamespaceOnce(t *testing.T) {
  assertSilent(t, runSingularRule(t, "src/Something.ts", `
export class Something {}
export namespace Something {
  export const version: string = "1";
}
`))
}
