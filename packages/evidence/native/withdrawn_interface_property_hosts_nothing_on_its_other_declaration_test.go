package evidence

import (
  "testing"
)

/**
 * Verifies the same reconciliation reaches a merged interface's members.
 *
 * The host set is filled one node at a time by whichever collector walked the
 * container, and withdrawal belongs to the identity, so every declaration form
 * that can spell one identity twice has the same leak. An interface declared
 * twice is the second such form: TypeScript accepts a repeated member whose type
 * matches, and the untagged copy kept discharging coverage. Closing the class
 * once rather than per container is what this pins.
 *
 *  1. Withdraw a property in one interface declaration and cite it from the
 *     other.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the citation is refused and the section stays unacknowledged.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the citation is refused and the section stays unacknowledged.
 * @evidence contracts/testing.md#independent-expectations The host set is filled one node at a time by whichever collector walked the container, and withdrawal belongs to the identity, so every declaration form that can spell one identity twice has the same leak. An interface declared twice is the second such form: TypeScript accepts a repeated member whose type matches, and the untagged copy kept discharging coverage. Closing the class once rather than per container is what this pins. The authored scenario requires this outcome: Assert the citation is refused and the section stays unacknowledged.
 * @evidence contracts/testing.md#distinguishing-cases Withdraw a property in one interface declaration and cite it from the other. Evaluate a `symbol: "property"` claim over that file. Assert the citation is refused and the section stays unacknowledged.
 * @evidence contracts/testing.md#execution-ownership TestWithdrawnInterfacePropertyHostsNothingOnItsOtherDeclaration runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestWithdrawnInterfacePropertyHostsNothingOnItsOtherDeclaration(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n",
    "src/ISale.ts": `
export interface ISale {
  /**
   * @internal
   */
  price: number;
  live: number;
}
export interface ISale {
  /** @evidence docs/spec.md#pricing A withdrawn property hosts nothing. */
  price: number;
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/ISale.ts"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(t, messages, "unsupported or non-exported declaration")
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#pricing'")
}
