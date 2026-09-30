package evidence

import (
  "testing"
)

/**
 * Verifies a function-valued variable hosts no property claim.
 *
 * The variable complementary rows pin the `type` axis on both positions and say nothing
 * about the two kinds a variable really registers. A `const` initialized with a
 * function registers `function`, so a `property` claim must refuse it, and the
 * data `const` beside it is what makes that claim active at all.
 *
 *  1. Cite a Markdown section from a function-valued `const`.
 *  2. Evaluate a `symbol: "property"` claim over that file.
 *  3. Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#behavioral-verification assertHostRefused exercises the authored fixture. Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#independent-expectations The variable complementary rows pin the `type` axis on both positions and say nothing about the two kinds a variable really registers. A `const` initialized with a function registers `function`, so a `property` claim must refuse it, and the data `const` beside it is what makes that claim active at all. The authored scenario requires this outcome: Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#distinguishing-cases Cite a Markdown section from a function-valued `const`. Evaluate a `symbol: "property"` claim over that file. Assert the host is refused and the section stays owed.
 * @evidence contracts/testing.md#execution-ownership TestCallableVariableIsNotAPropertyHost runs as a Go unit entry in the native package. assertHostRefused executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestCallableVariableIsNotAPropertyHost(t *testing.T) {
  assertHostRefused(t, `
/** @evidence docs/spec.md#contract A callable variable is not a property. */
export const parse = (): void => {};
export const limit = 1;
`, "property", "function")
}
