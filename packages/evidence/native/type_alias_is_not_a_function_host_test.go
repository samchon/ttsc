package evidence

import (
  "testing"
)

/**
 * Verifies an object-shaped type alias hosts a citation for `type` alone.
 *
 * The alias is the container whose members classify by the same rule as an
 * interface's, so a registration meant for a member is as easy to write here,
 * and nothing noticed either spelling.
 *
 *  1. Cite a Markdown section from an exported object-shaped type alias.
 *  2. Evaluate a `symbol: "function"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#behavioral-verification assertHostRefused runs runIndexRule over an exported object-shaped type alias carrying an @evidence citation of docs/spec.md#contract under a claim with symbol 'function'; the diagnostics must contain "host kind 'type' is not selected (function)" and a missing acknowledgement for 'docs/spec.md#contract'.
 * @evidence contracts/testing.md#independent-expectations The expected diagnostic text and the still-missing section are authored literals from the host-eligibility contract that a type alias registers as host kind 'type' and is not a function host. Asserting the kind name 'type' ties the result to the alias's registration, not only to the selector.
 * @evidence contracts/testing.md#distinguishing-cases A refusal case for selector 'function': both the refusal diagnostic and the section staying missing are required, so a deactivated claim or a quiet pass cannot satisfy it. The fixture's uncited exported function activate is a selected host, which keeps the claim active. The accepting case (symbol 'type' hosting the same alias) is not executed here.
 * @evidence contracts/testing.md#execution-ownership TestTypeAliasIsNotAFunctionHost is a selectable native Go unit entry. It has assertHostRefused write the Markdown and TypeScript fixtures to a temp root and call graphRule.Check through runIndexRule in-process; no consumer, Node process, native build or product host is started.
 */
func TestTypeAliasIsNotAFunctionHost(t *testing.T) {
  assertHostRefused(t, refusedTypeAliasSource, "function", "type")
}
