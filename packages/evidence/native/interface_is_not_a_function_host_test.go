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
 * @evidence contracts/testing.md#behavioral-verification assertHostRefused exercises the authored fixture. Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#independent-expectations `addTypeScriptHost` registers one kind per declaration, and the registration is the only thing standing between a claim's selector and a tag it was written to exclude. An over-broad registration does not error: it accepts the tag and discharges a reference, so a project that narrowed `symbol` deliberately would have that narrowing quietly stop applying. Adding `"function"` to the interface was a one-line edit the whole suite tolerated. The authored scenario requires this outcome: Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#distinguishing-cases Cite a Markdown section from an exported interface. Evaluate a `symbol: "function"` claim over that file. Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#execution-ownership TestInterfaceIsNotAFunctionHost runs as a Go unit entry in the native package. assertHostRefused executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestInterfaceIsNotAFunctionHost(t *testing.T) {
  assertHostRefused(t, refusedInterfaceSource, "function", "type")
}
