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
 *
 * @evidence contracts/testing.md#behavioral-verification assertHostRefused runs the graph rule with a claim whose symbol is `property` over an interface whose method signature `run(): void` carries `@evidence docs/spec.md#contract` beside a data member `label`; it requires `host kind 'function' is not selected (property)` and `Missing acknowledgement for 'docs/spec.md#contract'`.
 * @evidence contracts/testing.md#independent-expectations The expected messages are authored from the host-eligibility contract: a method signature registers as a function at its own site, so a property claim must refuse a citation on it, while the data member keeps the claim active.
 * @evidence contracts/testing.md#distinguishing-cases The member-level counterpart of the interface-container refusals: the method signature (refused) beside the data member the property selector owns.
 * @evidence contracts/testing.md#execution-ownership TestInterfaceMethodSignatureIsNotAPropertyHost is a Go unit entry in the native test process; assertHostRefused writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
