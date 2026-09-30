package evidence

import (
  "testing"
)

/**
 * Verifies a dotted namespace does not host a property claim either.
 *
 * Both of its wrong selectors are refused for the reason the module-scope
 * namespace has two rows: it is the container that holds every kind at once.
 *
 *  1. Cite the same section from the same dotted namespace.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification assertHostRefused exercises the authored fixture. Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Both of its wrong selectors are refused for the reason the module-scope namespace has two rows: it is the container that holds every kind at once. The authored scenario requires this outcome: Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Cite the same section from the same dotted namespace. Evaluate a `symbol: "property"` claim over that file. Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDottedNamespaceIsNotAPropertyHost runs as a Go unit entry in the native package. assertHostRefused executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestDottedNamespaceIsNotAPropertyHost(t *testing.T) {
  assertHostRefused(t, `
/** @evidence docs/spec.md#contract A dotted namespace is not a property. */
export namespace Outer.Inner {
  export interface Input {
    id: string;
  }
}
export const activate = 1;
`, "property", "type")
}
