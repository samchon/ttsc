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
 * @evidence contracts/testing.md#behavioral-verification assertHostRefused exercises the authored fixture. Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#independent-expectations The twin of the complementary case on the other selector. An interface declares property members, so `"property"` is the registration a reader is most likely to assume belongs on the container rather than on the members, and it was the second one-line edit the suite tolerated. The authored scenario requires this outcome: Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#distinguishing-cases Cite the same section from the same interface. Evaluate a `symbol: "property"` claim over that file. Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#execution-ownership TestInterfaceIsNotAPropertyHost runs as a Go unit entry in the native package. assertHostRefused executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestInterfaceIsNotAPropertyHost(t *testing.T) {
  assertHostRefused(t, refusedInterfaceSource, "property", "type")
}
