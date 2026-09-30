package evidence

import (
  "testing"
)

/**
 * Verifies an interface method signature hosts no property claim.
 *
 * The member half of the interface, which the container complementary rows do not
 * reach: members register at their own site, and a method signature is a
 * `function` there, so a `property` claim must refuse it. The data member
 * beside it activates the claim and is the one the selector owns.
 *
 *  1. Cite a Markdown section from an interface method signature.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification assertHostRefused exercises the authored fixture. Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The member half of the interface, which the container complementary rows do not reach: members register at their own site, and a method signature is a `function` there, so a `property` claim must refuse it. The data member beside it activates the claim and is the one the selector owns. The authored scenario requires this outcome: Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Cite a Markdown section from an interface method signature. Evaluate a `symbol: "property"` claim over that file. Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestInterfaceMethodSignatureIsNotAPropertyHost runs as a Go unit entry in the native package. assertHostRefused executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestInterfaceMethodSignatureIsNotAPropertyHost(t *testing.T) {
  assertHostRefused(t, `
export interface ISale {
  /** @evidence docs/spec.md#contract A method signature is not a property. */
  run(): void;
  label: string;
}
`, "property", "function")
}
