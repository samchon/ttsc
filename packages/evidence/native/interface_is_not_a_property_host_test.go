package evidence

import (
  "testing"
)

/**
 * Verifies an interface does not host a property claim either.
 *
 * The twin of the complementary case on the other selector. An interface declares
 * property members, so `"property"` is the registration a reader is most likely
 * to assume belongs on the container rather than on the members, and it was the
 * second one-line edit the suite tolerated.
 *
 *  1. Cite the same section from the same interface.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 *
 * @evidence contracts/testing.md#behavioral-verification assertHostRefused runs the graph rule with a claim whose symbol is `property` over the same documented `export interface ISale` carrying `@evidence docs/spec.md#contract` beside `export function activate()`; it requires `host kind 'type' is not selected (property)` and `Missing acknowledgement for 'docs/spec.md#contract'`.
 * @evidence contracts/testing.md#independent-expectations The expected messages are authored from the host-eligibility contract: the interface container registers only `type` (its property members register separately), so a property claim must refuse a citation on the container.
 * @evidence contracts/testing.md#distinguishing-cases The property-selector counterpart of the function-selector refusal in the sibling entry, using the identical fixture so only the claim selector differs.
 * @evidence contracts/testing.md#execution-ownership TestInterfaceIsNotAPropertyHost is a Go unit entry in the native test process; assertHostRefused writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestInterfaceIsNotAPropertyHost(t *testing.T) {
  assertHostRefused(t, refusedInterfaceSource, "property", "type")
}
