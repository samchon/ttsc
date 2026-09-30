package evidence

import (
  "testing"
)

/**
 * Verifies nested declarations are read: an interface property's block counts.
 *
 * The whole file is the population, and a nested block is where a stubbed
 * member's debt actually sits. A scan that stopped at top-level statements
 * would let every property and method stub ship silently.
 *
 *  1. Put a '@todo' on an interface property, under a realized interface block.
 *  2. Run the rule.
 *  3. Assert one finding carrying the property's tag text.
 * @evidence contracts/testing.md#behavioral-verification runTodoRule checks a todo on ISale.price beneath a prose-only interface block; assertReported requires its nested debt.
 * @evidence contracts/testing.md#independent-expectations Nested member documentation is part of the todo scan and cannot hide behind a realized outer declaration.
 * @evidence contracts/testing.md#distinguishing-cases The property-level marker challenges scans limited to top-level statement blocks.
 * @evidence contracts/testing.md#execution-ownership TestTodoReportsTagsOnNestedDeclarations is a selectable native Go unit entry. runTodoRule parses its supplied source and invokes todoRule.Check in-process; source strings and reporter messages remain local to this entry.
 */
func TestTodoReportsTagsOnNestedDeclarations(t *testing.T) {
  messages := runTodoRule(t, "src/ISale.ts", `
/** A sale offered to a customer. */
export interface ISale {
  /** @todo settle the currency model */
  price: number;
}
`)
  assertReported(t, messages, "Unrealized '@todo': 'settle the currency model'")
}
