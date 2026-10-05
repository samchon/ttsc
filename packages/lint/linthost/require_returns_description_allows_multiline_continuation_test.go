package linthost

import "testing"

// TestRuleJSDocRequireReturnsDescriptionAllowsMultilineContinuation verifies
// jsdoc/require-returns-description counts an indented continuation line after
// a typed @returns as its description.
//
//  1. Run the rule over a block with `@returns {number}` on one line and
//     `Rounded total.` on the next indented line.
//  2. Expect no findings.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines runs the registered jsdoc/require-returns-description rule through NewEngine.Run over a parsed virtual TypeScript file and requires zero findings for a typed @returns whose description starts on the next comment line.
// @evidence contracts/testing.md#independent-expectations Wrapped JSDoc prose belongs to the preceding tag, so the authored continuation line satisfies the description requirement. The zero expectation is a literal.
// @evidence contracts/testing.md#distinguishing-cases This is the wrapped-prose accepted case. TestRuleJSDocRequireReturnsDescription reports a @returns with only a type and accepts one with a same-line description.
// @evidence contracts/testing.md#execution-ownership The Test is a single Go unit with one direct helper call; assertJSDocRuleLines parses the source with parseTSFile and runs the rule engine in the test process, with no installed consumer, native build or host.
func TestRuleJSDocRequireReturnsDescriptionAllowsMultilineContinuation(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-returns-description", `/**
 * Computes a value.
 * @returns {number}
 *   Rounded total.
 */
export function compute(): number {
  return 1;
}
`)
}
