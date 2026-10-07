package evidence

import (
  "testing"
)

/**
 * Verifies a callable declarator hosts no property claim.
 *
 * The declarator's other axis, and the one the statement row cannot reach. A
 * declarator chooses `property` or `function` from its own initializer, so a
 * statement-level citation lands on the wrapper and says nothing about which
 * kind the declarator registered. The tag goes on the inner declarator for that
 * reason, and the data declarator beside it activates the claim.
 *
 *  1. Cite a Markdown section from a function-valued inner declarator.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 *
 * @evidence contracts/testing.md#behavioral-verification assertHostRefused runs the graph rule with a claim whose symbol is `property` over a file declaring `alpha = 1` and a documented `beta = (): void => {}` carrying `@evidence docs/spec.md#contract`; it requires a diagnostic `host kind 'function' is not selected (property)` and `Missing acknowledgement for 'docs/spec.md#contract'`.
 * @evidence contracts/testing.md#independent-expectations The expected messages are authored from the host-eligibility contract: a declarator registers as function or property from its own initializer, so the arrow-function declarator is a function host that a property claim must refuse, leaving the section owed.
 * @evidence contracts/testing.md#distinguishing-cases The citation sits on the inner declarator (the data declarator alpha activates the claim), separating declarator-level kind from the statement wrapper; the same shape for a function claim is owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestCallableDeclaratorIsNotAPropertyHost is a Go unit entry in the native test process; assertHostRefused writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestCallableDeclaratorIsNotAPropertyHost(t *testing.T) {
  assertHostRefused(t, `
export const alpha = 1,
  /** @evidence docs/spec.md#contract A callable declarator is not a property. */
  beta = (): void => {};
`, "property", "function")
}
