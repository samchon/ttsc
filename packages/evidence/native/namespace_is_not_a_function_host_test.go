package evidence

import (
  "testing"
)

/**
 * Verifies a namespace hosts a citation for `type` alone.
 *
 * A namespace contains callables and data, so its own registration is the one
 * most likely to be widened to whatever it holds. Nothing inside it is
 * callable, so the activating declaration for this row sits outside it.
 *
 *  1. Cite a Markdown section from an exported namespace.
 *  2. Evaluate a `symbol: "function"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification assertHostRefused exercises the authored fixture. Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A namespace contains callables and data, so its own registration is the one most likely to be widened to whatever it holds. Nothing inside it is callable, so the activating declaration for this row sits outside it. The authored scenario requires this outcome: Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Cite a Markdown section from an exported namespace. Evaluate a `symbol: "function"` claim over that file. Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestNamespaceIsNotAFunctionHost runs as a Go unit entry in the native package. assertHostRefused executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestNamespaceIsNotAFunctionHost(t *testing.T) {
  assertHostRefused(t, refusedNamespaceSource, "function", "type")
}
