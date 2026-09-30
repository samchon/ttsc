package evidence

import (
  "testing"
)

/**
 * Verifies a namespace does not host a property claim either.
 *
 * The namespace is the only container that holds every kind at once, so both of
 * its wrong selectors have to be refused rather than one standing for the
 * other. What activates this row is the nested member `Orders.Input.id` rather
 * than the declaration outside the namespace, so removing that member silences
 * the row instead of changing what it asserts.
 *
 *  1. Cite the same section from the same namespace.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#behavioral-verification assertHostRefused exercises the authored fixture. Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#independent-expectations The namespace is the only container that holds every kind at once, so both of its wrong selectors have to be refused rather than one standing for the other. What activates this row is the nested member `Orders.Input.id` rather than the declaration outside the namespace, so removing that member silences the row instead of changing what it asserts. The authored scenario requires this outcome: Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#distinguishing-cases Cite the same section from the same namespace. Evaluate a `symbol: "property"` claim over that file. Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#execution-ownership TestNamespaceIsNotAPropertyHost runs as a Go unit entry in the native package. assertHostRefused executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestNamespaceIsNotAPropertyHost(t *testing.T) {
  assertHostRefused(t, refusedNamespaceSource, "property", "type")
}
