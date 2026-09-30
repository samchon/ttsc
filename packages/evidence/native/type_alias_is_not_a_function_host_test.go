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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification assertHostRefused exercises the authored fixture. Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The alias is the container whose members classify by the same rule as an interface's, so a registration meant for a member is as easy to write here, and nothing noticed either spelling. The authored scenario requires this outcome: Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Cite a Markdown section from an exported object-shaped type alias. Evaluate a `symbol: "function"` claim over that file. Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTypeAliasIsNotAFunctionHost runs as a Go unit entry in the native package. assertHostRefused executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeAliasIsNotAFunctionHost(t *testing.T) {
  assertHostRefused(t, refusedTypeAliasSource, "function", "type")
}
