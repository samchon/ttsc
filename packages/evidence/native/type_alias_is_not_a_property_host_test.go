package evidence

import (
  "testing"
)

/**
 * Verifies an object-shaped type alias does not host a property claim.
 *
 * The other selector, and the likelier mistake of the two: an alias whose whole
 * body is property members reads as a property host to anyone writing the
 * registration from what the declaration contains rather than from what it is.
 *
 *  1. Cite the same section from the same alias.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification assertHostRefused exercises the authored fixture. Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The other selector, and the likelier mistake of the two: an alias whose whole body is property members reads as a property host to anyone writing the registration from what the declaration contains rather than from what it is. The authored scenario requires this outcome: Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Cite the same section from the same alias. Evaluate a `symbol: "property"` claim over that file. Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTypeAliasIsNotAPropertyHost runs as a Go unit entry in the native package. assertHostRefused executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeAliasIsNotAPropertyHost(t *testing.T) {
  assertHostRefused(t, refusedTypeAliasSource, "property", "type")
}
