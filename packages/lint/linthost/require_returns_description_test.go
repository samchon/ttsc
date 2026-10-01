package linthost

import "testing"

// TestRuleJSDocRequireReturnsDescription verifies
// jsdoc/require-returns-description reports a @returns that has only a type and
// accepts one with a description.
//
// The rule reads the tag payload straight from the comment line.
//
// 1. Run the rule over a block whose third line is `@returns {number}` and
//    expect one finding on line 3.
// 2. Run the rule over a block with `@returns {number} Rounded total.` and expect none.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines runs the registered jsdoc/require-returns-description rule through NewEngine.Run over a parsed virtual TypeScript file. `@returns {number}` yields exactly one finding, with that rule at error severity, on line 3; `@returns {number} Rounded total.` yields none.
// @evidence contracts/testing.md#independent-expectations A result type does not explain the returned value, so a description is required after the type. The literal sources and expected line 3 follow from that policy; the message text is not asserted.
// @evidence contracts/testing.md#distinguishing-cases The two sources differ only in the description after the {number} type. The wrapped-description case is owned by the multiline-continuation Test.
// @evidence contracts/testing.md#execution-ownership The Test is a single Go unit with two direct helper calls; assertJSDocRuleLines parses the source with parseTSFile and runs the rule engine in the test process, with no installed consumer, native build or host.
func TestRuleJSDocRequireReturnsDescription(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-returns-description", `/**
 * Computes a value.
 * @returns {number}
 */
export function compute(): number {
  return 1;
}
`, 3)
  assertJSDocRuleLines(t, "jsdoc/require-returns-description", "/**\n * Explains the declaration.\n * @returns {number} Rounded total.\n */\nexport function value(name: unknown): unknown { return name; }\n")
}
