package linthost

import "testing"

// TestRuleJSDocCheckValues verifies jsdoc/check-values reports an @access value
// outside the visibility vocabulary and accepts `public`.
//
// The rule validates only @access, whose valid values are a closed set, so no
// TypeScript checker is needed.
//
// 1. Run the rule over a block whose third line is `@access friend` and
//    expect one finding on line 3.
// 2. Run the rule over a block with `@access public` and expect none.
// 3. Repeat for `protected`, `private` and `package` and expect none.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines runs the registered jsdoc/check-values rule through NewEngine.Run over a parsed virtual TypeScript file. `@access friend` yields exactly one finding, with that rule at error severity, on line 3; `@access public`, `protected`, `private` and `package` each yield none.
// @evidence contracts/testing.md#independent-expectations The JSDoc @access vocabulary is public, protected, private and package, so `friend` is invalid and `public` is valid. The literal sources and the expected line 3 follow from that vocabulary; the message text is not asserted.
// @evidence contracts/testing.md#distinguishing-cases The authored friend block is rejected; four separately authored function blocks accept public/protected/private/package. The positive and clean blocks also differ in description and declaration shape.
// @evidence contracts/testing.md#execution-ownership The Test is a single Go unit invoking the helper for one rejected value and all four accepted values; assertJSDocRuleLines parses the source with parseTSFile and runs the rule engine in the test process, with no installed consumer, native build or host.
func TestRuleJSDocCheckValues(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/check-values", `/**
 * Creates a value.
 * @access friend
 */
export const value = 1;
`, 3)
  assertJSDocRuleLines(t, "jsdoc/check-values", "/**\n * Explains the declaration.\n * @access public\n */\nexport function value(name: unknown): unknown { return name; }\n")
  for _, access := range []string{"protected", "private", "package"} {
    assertJSDocRuleLines(t, "jsdoc/check-values", "/**\n * Explains the declaration.\n * @access "+access+"\n */\nexport function value(name: unknown): unknown { return name; }\n")
  }
}
