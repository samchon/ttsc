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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification assertHostRefused exercises the authored fixture. Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A class member registers exactly the kind `memberSymbol` gave it, and both kinds share one registration site, so an over-broad one there reaches every member of every class at once. The method beside the field activates the claim and is the member the selector legitimately owns, so the row states the boundary between them rather than the absence of both. The authored scenario requires this outcome: Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Cite a Markdown section from a public class field. Evaluate a `symbol: "function"` claim over that file. Assert the host is refused and the section stays owed.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestClassFieldIsNotAFunctionHost runs as a Go unit entry in the native package. assertHostRefused executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
