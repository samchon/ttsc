package evidence

import (
  "testing"
)

/**
 * Verifies a class field hosts no function claim.
 *
 * A class member registers exactly the kind `memberSymbol` gave it, and both
 * kinds share one registration site, so an over-broad one there reaches every
 * member of every class at once. The method beside the field activates the
 * claim and is the member the selector legitimately owns, so the row states the
 * boundary between them rather than the absence of both.
 *
 *  1. Cite a Markdown section from a public class field.
 *  2. Evaluate a `symbol: "function"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 *
 * @evidence contracts/testing.md#behavioral-verification assertHostRefused runs the graph rule with a claim whose symbol is `function` over `class Sale` whose documented public field `price` carries `@evidence docs/spec.md#contract` beside a method `charge`; it requires `host kind 'property' is not selected (function)` and `Missing acknowledgement for 'docs/spec.md#contract'`.
 * @evidence contracts/testing.md#independent-expectations The expected messages are authored from the host-eligibility contract: a class member registers the kind its syntax gives it, so a field is a property host that a function claim must refuse, leaving the section owed; the method activates the claim.
 * @evidence contracts/testing.md#distinguishing-cases The field (refused) beside a method (the member the function claim legitimately selects) separates the property and function kinds within one class; the variable and declarator forms are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestClassFieldIsNotAFunctionHost is a Go unit entry in the native test process; assertHostRefused writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestClassFieldIsNotAFunctionHost(t *testing.T) {
  assertHostRefused(t, `
export class Sale {
  /** @evidence docs/spec.md#contract A field is not a callable. */
  readonly price: number = 0;
  charge(): void {}
}
`, "function", "property")
}
