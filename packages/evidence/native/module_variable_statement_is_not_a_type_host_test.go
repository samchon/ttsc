package evidence

import (
  "testing"
)

/**
 * Verifies a variable statement wrapper hosts no type claim.
 *
 * A variable registers two host positions and each needs its own row, because a
 * tag reaches exactly one of them. TypeScript attaches a leading block to the
 * statement, so this is the position an ordinary citation consults.
 *
 *  1. Cite a Markdown section from an exported `const`.
 *  2. Evaluate a `symbol: "type"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#behavioral-verification assertHostRefused exercises the authored fixture. Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#independent-expectations A variable registers two host positions and each needs its own row, because a tag reaches exactly one of them. TypeScript attaches a leading block to the statement, so this is the position an ordinary citation consults. The authored scenario requires this outcome: Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#distinguishing-cases Cite a Markdown section from an exported `const`. Evaluate a `symbol: "type"` claim over that file. Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#execution-ownership TestModuleVariableStatementIsNotATypeHost runs as a Go unit entry in the native package. assertHostRefused executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestModuleVariableStatementIsNotATypeHost(t *testing.T) {
  assertHostRefused(t, `
/** @evidence docs/spec.md#contract A variable is not a type. */
export const limit = 1;
export interface IActivate {
  id: string;
}
`, "type", "property")
}
