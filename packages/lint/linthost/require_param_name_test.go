package linthost

import "testing"

// TestRuleJSDocRequireParamName verifies jsdoc/require-param-name reports a
// @param that has only a type and accepts one that names the parameter.
//
//  1. Run the rule over a block whose third line is `@param {string}` and
//     expect one finding on line 3.
//  2. Run the rule over a block with `@param {string} name description` and expect none.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines runs the registered jsdoc/require-param-name rule through NewEngine.Run over a parsed virtual TypeScript file. `@param {string}` yields exactly one finding, with that rule at error severity, on line 3; `@param {string} name description` yields none.
// @evidence contracts/testing.md#independent-expectations A type alone cannot identify the documented parameter. The literal sources and expected line 3 follow from that policy; the message text is not asserted.
// @evidence contracts/testing.md#distinguishing-cases The authored type-only tag reports and the separately authored named tag stays clean while both retain {string}; their block prose, function names and TypeScript types also differ.
// @evidence contracts/testing.md#execution-ownership The Test is a single Go unit with two direct helper calls; assertJSDocRuleLines parses the source with parseTSFile and runs the rule engine in the test process, with no installed consumer, native build or host.
func TestRuleJSDocRequireParamName(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-param-name", `/**
 * Handles a name.
 * @param {string}
 */
export function handle(name: string): string {
  return name;
}
`, 3)
  assertJSDocRuleLines(t, "jsdoc/require-param-name", "/**\n * Explains the declaration.\n * @param {string} name description\n */\nexport function value(name: unknown): unknown { return name; }\n")
}
