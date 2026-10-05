package linthost

import "testing"

// TestRuleJSDocRequirePropertyDescriptionAllowsMultilineContinuation verifies
// jsdoc/require-property-description counts an indented continuation line as
// the description of the preceding @property tag.
//
//  1. Run the rule over a block with `@property name` on one line and
//     `Human-readable option name.` on the next indented line.
//  2. Expect no findings.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines runs the registered jsdoc/require-property-description rule through NewEngine.Run over a parsed virtual TypeScript file and requires zero findings for a @property whose description starts on the next comment line.
// @evidence contracts/testing.md#independent-expectations Wrapped JSDoc prose belongs to the preceding tag, so the authored continuation line satisfies the description requirement. The zero expectation is a literal.
// @evidence contracts/testing.md#distinguishing-cases This is the wrapped-prose accepted case. TestRuleJSDocRequirePropertyDescription reports a @property with no description and accepts one on the same line.
// @evidence contracts/testing.md#execution-ownership The Test is a single Go unit with one direct helper call; assertJSDocRuleLines parses the source with parseTSFile and runs the rule engine in the test process, with no installed consumer, native build or host.
func TestRuleJSDocRequirePropertyDescriptionAllowsMultilineContinuation(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-property-description", `/**
 * Options bag.
 * @property name
 *   Human-readable option name.
 */
export interface Options {
  name: string;
}
`)
}
