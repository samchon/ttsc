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
 * @evidence contracts/testing.md#behavioral-verification assertHostRefused exercises the authored fixture. Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#independent-expectations The declarator's other axis, and the one the statement row cannot reach. A declarator chooses `property` or `function` from its own initializer, so a statement-level citation lands on the wrapper and says nothing about which kind the declarator registered. The tag goes on the inner declarator for that reason, and the data declarator beside it activates the claim. The authored scenario requires this outcome: Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#distinguishing-cases Cite a Markdown section from a function-valued inner declarator. Evaluate a `symbol: "property"` claim over that file. Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#execution-ownership TestCallableDeclaratorIsNotAPropertyHost runs as a Go unit entry in the native package. assertHostRefused executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestCallableDeclaratorIsNotAPropertyHost(t *testing.T) {
  assertHostRefused(t, `
export const alpha = 1,
  /** @evidence docs/spec.md#contract A callable declarator is not a property. */
  beta = (): void => {};
`, "property", "function")
}
