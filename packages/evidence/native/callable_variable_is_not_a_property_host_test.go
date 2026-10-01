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
 * @evidence contracts/testing.md#behavioral-verification assertHostRefused runs the graph rule with a claim whose symbol is `property` over a file whose documented `export const parse = (): void => {}` carries `@evidence docs/spec.md#contract` beside a data `export const limit = 1`; it requires `host kind 'function' is not selected (property)` and `Missing acknowledgement for 'docs/spec.md#contract'`.
 * @evidence contracts/testing.md#independent-expectations The expected messages are authored from the host-eligibility contract: a const initialized with a function registers as a function unit, so a property claim must refuse it as a host and leave the section owed; the data const makes the property claim active.
 * @evidence contracts/testing.md#distinguishing-cases The callable variable (refused) beside a data variable (which activates the claim) separates the function and property kinds of one variable form; the declarator-level form is owned by the sibling declarator entry.
 * @evidence contracts/testing.md#execution-ownership TestCallableVariableIsNotAPropertyHost is a Go unit entry in the native test process; assertHostRefused writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestCallableVariableIsNotAPropertyHost(t *testing.T) {
  assertHostRefused(t, `
/** @evidence docs/spec.md#contract A callable variable is not a property. */
export const parse = (): void => {};
export const limit = 1;
`, "property", "function")
}
