package evidence

import (
  "testing"
)

/**
 * Verifies a dotted namespace does not host a property claim either.
 *
 * Both of its wrong selectors are refused for the reason the module-scope
 * namespace has two rows: it is the container that holds every kind at once.
 *
 *  1. Cite the same section from the same dotted namespace.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#behavioral-verification assertHostRefused runs the graph rule with a claim whose symbol is `property` over `export namespace Outer.Inner` carrying `@evidence docs/spec.md#contract` beside `export const activate = 1`; it requires `host kind 'type' is not selected (property)` and `Missing acknowledgement for 'docs/spec.md#contract'`.
 * @evidence contracts/testing.md#independent-expectations The expected messages are authored from the host-eligibility contract: a dotted namespace registers its outer declaration as a type host, which a property claim must refuse; the data const keeps the claim active.
 * @evidence contracts/testing.md#distinguishing-cases The property-claim counterpart of the function-claim refusal in the sibling dotted-namespace entry; the same fixture form is refused under both wrong selectors.
 * @evidence contracts/testing.md#execution-ownership TestDottedNamespaceIsNotAPropertyHost is a Go unit entry in the native test process; assertHostRefused writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestDottedNamespaceIsNotAPropertyHost(t *testing.T) {
  assertHostRefused(t, `
/** @evidence docs/spec.md#contract A dotted namespace is not a property. */
export namespace Outer.Inner {
  export interface Input {
    id: string;
  }
}
export const activate = 1;
`, "property", "type")
}
