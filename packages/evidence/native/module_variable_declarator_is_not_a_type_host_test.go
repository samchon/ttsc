package evidence

import (
  "testing"
)

/**
 * Verifies a variable declarator hosts no type claim either.
 *
 * The other position, and the one the complementary case cannot reach: a block above
 * the statement is the statement's, so an over-registration on the declarator
 * stayed invisible however many statement-level citations the suite wrote. A
 * tag on an inner declarator is what consults it.
 *
 *  1. Cite a Markdown section from the second declarator of a statement.
 *  2. Evaluate a `symbol: "type"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 *
 * @evidence contracts/testing.md#behavioral-verification assertHostRefused exercises the authored fixture. Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#independent-expectations The other position, and the one the complementary case cannot reach: a block above the statement is the statement's, so an over-registration on the declarator stayed invisible however many statement-level citations the suite wrote. A tag on an inner declarator is what consults it. The authored scenario requires this outcome: Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#distinguishing-cases Cite a Markdown section from the second declarator of a statement. Evaluate a `symbol: "type"` claim over that file. Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#execution-ownership TestModuleVariableDeclaratorIsNotATypeHost runs as a Go unit entry in the native package. assertHostRefused executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestModuleVariableDeclaratorIsNotATypeHost(t *testing.T) {
  assertHostRefused(t, `
export const alpha = 1,
  /** @evidence docs/spec.md#contract A declarator is not a type. */
  beta = 2;
export interface IActivate {
  id: string;
}
`, "type", "property")
}
