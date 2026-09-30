package evidence

import (
  "testing"
)

/**
 * Verifies identity counting: a merged interface and namespace of one name stay
 * one identity.
 *
 * This is the form the rule exists to permit. A rule that counted exports would
 * report the everyday `interface` plus `namespace` idiom as two, which is why
 * the counted unit is an identity and why this case, not the single-declaration
 * one, is the anchor of the design.
 *
 *  1. Declare an interface and a namespace of the same exported name.
 *  2. Run the rule against a file named after them.
 *  3. Assert silence.
 * @evidence contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert silence.
 * @evidence contracts/testing.md#independent-expectations This is the form the rule exists to permit. A rule that counted exports would report the everyday `interface` plus `namespace` idiom as two, which is why the counted unit is an identity and why this case, not the single-declaration one, is the anchor of the design. The authored scenario requires this outcome: Assert silence.
 * @evidence contracts/testing.md#distinguishing-cases Declare an interface and a namespace of the same exported name. Run the rule against a file named after them. Assert silence.
 * @evidence contracts/testing.md#execution-ownership TestSingularCountsMergedInterfaceAndNamespaceOnce runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularCountsMergedInterfaceAndNamespaceOnce(t *testing.T) {
  assertSilent(t, runSingularRule(t, "src/ISomething.ts", `
export interface ISomething {
  id: string;
}
export namespace ISomething {
  export interface ICreate {
    id: string;
  }
}
`))
}
