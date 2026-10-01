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
 * @evidence contracts/testing.md#behavioral-verification assertHostRefused runs runIndexRule over an exported object-shaped type alias carrying an @evidence citation of docs/spec.md#contract under a claim with symbol 'property'; the diagnostics must contain "host kind 'type' is not selected (property)" and a missing acknowledgement for 'docs/spec.md#contract'.
 * @evidence contracts/testing.md#independent-expectations The expected diagnostic text and the still-missing section are authored literals from the host-eligibility contract that a type alias registers as host kind 'type' and is not a property host. Asserting the kind name 'type' ties the result to the alias's registration, not only to the selector.
 * @evidence contracts/testing.md#distinguishing-cases A refusal case for selector 'property': both the refusal diagnostic and the section staying missing are required, so a deactivated claim or a quiet pass cannot satisfy it. The accepting case (symbol 'type' hosting the same alias) is not executed here.
 * @evidence contracts/testing.md#execution-ownership TestTypeAliasIsNotAPropertyHost is a selectable native Go unit entry. It has assertHostRefused write the Markdown and TypeScript fixtures to a temp root and call graphRule.Check through runIndexRule in-process; no consumer, Node process, native build or product host is started.
 */
func TestTypeAliasIsNotAPropertyHost(t *testing.T) {
  assertHostRefused(t, refusedTypeAliasSource, "property", "type")
}
