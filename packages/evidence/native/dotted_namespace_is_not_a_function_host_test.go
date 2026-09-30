package evidence

import (
  "testing"
)

/**
 * Verifies a dotted namespace hosts a citation for `type` alone.
 *
 * `export namespace Outer.Inner {}` is parsed as nested module declarations and
 * resolves through the same registration the module-scope rows use, so what it
 * pins is that the outer declaration is still registered when a dotted form
 * flows through that branch: narrowing that registration to skip a nested body
 * reddens these two rows and no others. The inner registration is unreachable
 * by any citation, because TypeScript attaches a leading block to the outer
 * declaration, so it gets no row.
 *
 *  1. Cite a Markdown section from a dotted namespace.
 *  2. Evaluate a `symbol: "function"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification assertHostRefused exercises the authored fixture. Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations `export namespace Outer.Inner {}` is parsed as nested module declarations and resolves through the same registration the module-scope rows use, so what it pins is that the outer declaration is still registered when a dotted form flows through that branch: narrowing that registration to skip a nested body reddens these two rows and no others. The inner registration is unreachable by any citation, because TypeScript attaches a leading block to the outer declaration, so it gets no row. The authored scenario requires this outcome: Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Cite a Markdown section from a dotted namespace. Evaluate a `symbol: "function"` claim over that file. Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDottedNamespaceIsNotAFunctionHost runs as a Go unit entry in the native package. assertHostRefused executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestDottedNamespaceIsNotAFunctionHost(t *testing.T) {
  assertHostRefused(t, `
/** @evidence docs/spec.md#contract A dotted namespace is not a callable. */
export namespace Outer.Inner {
  export interface Input {
    id: string;
  }
}
export function activate(): void {}
`, "function", "type")
}
