package evidence

import (
  "testing"
)

/**
 * Verifies an interface hosts a citation for `type` and for nothing else.
 *
 * `addTypeScriptHost` registers one kind per declaration, and the registration
 * is the only thing standing between a claim's selector and a tag it was
 * written to exclude. An over-broad registration does not error: it accepts the
 * tag and discharges a reference, so a project that narrowed `symbol`
 * deliberately would have that narrowing quietly stop applying. Adding
 * `"function"` to the interface was a one-line edit the whole suite tolerated.
 *
 *  1. Cite a Markdown section from an exported interface.
 *  2. Evaluate a `symbol: "function"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#behavioral-verification assertHostRefused runs the graph rule with a claim whose symbol is `function` over a documented `export interface ISale` carrying `@evidence docs/spec.md#contract` beside `export function activate()`; it requires `host kind 'type' is not selected (function)` and `Missing acknowledgement for 'docs/spec.md#contract'`.
 * @evidence contracts/testing.md#independent-expectations The expected messages are authored from the host-eligibility contract: an interface registers only the `type` kind, so a function claim must refuse a citation on it; an over-broad registration would accept the tag and discharge the section, which the owed-section assertion would catch.
 * @evidence contracts/testing.md#distinguishing-cases The interface (refused) beside an uncited function (keeps the claim active); the property-claim refusal of the same source is owned by the sibling entry.
 * @evidence contracts/testing.md#execution-ownership TestInterfaceIsNotAFunctionHost is a Go unit entry in the native test process; assertHostRefused writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestInterfaceIsNotAFunctionHost(t *testing.T) {
  assertHostRefused(t, refusedInterfaceSource, "function", "type")
}
