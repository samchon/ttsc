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
 *
 * @evidence contracts/testing.md#behavioral-verification assertHostRefused runs the graph rule with a claim whose symbol is `function` over `export namespace Outer.Inner` carrying `@evidence docs/spec.md#contract` beside `export function activate()`; it requires `host kind 'type' is not selected (function)` and `Missing acknowledgement for 'docs/spec.md#contract'`.
 * @evidence contracts/testing.md#independent-expectations The expected messages are authored from the host-eligibility contract: a dotted namespace registers its outer declaration as a type host, which a function claim must refuse; the function `activate` keeps the claim active.
 * @evidence contracts/testing.md#distinguishing-cases The dotted form of a namespace, which flows through the nested-module branch; a registration change that skipped nested bodies would stop the outer declaration being a host, failing this case. Property-claim refusal of the same form is owned by the sibling entry.
 * @evidence contracts/testing.md#execution-ownership TestDottedNamespaceIsNotAFunctionHost is a Go unit entry in the native test process; assertHostRefused writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
