package linthost

import "testing"

// TestRuleJSDocRequireParamDescription verifies jsdoc/require-param-description
// reports a named @param without a description and accepts one with prose.
//
// The rule splits the optional type, the parameter name and the trailing
// description of one tag line.
//
// 1. Run the rule over a block whose third line is `@param name` and expect
//    one finding on line 3.
// 2. Run the rule over a block with `@param name Normalized display name.` and expect none.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines runs the registered jsdoc/require-param-description rule through NewEngine.Run over a parsed virtual TypeScript file. `@param name` yields exactly one finding, with that rule at error severity, on line 3; `@param name Normalized display name.` yields none.
// @evidence contracts/testing.md#independent-expectations A parameter name identifies the target and the description explains it, so a name alone is incomplete. The literal sources and expected line 3 follow from that policy; the message text is not asserted.
// @evidence contracts/testing.md#distinguishing-cases The two sources differ only in the trailing description text. The wrapped-description case is owned by the multiline-continuation Test, and a nameless @param is owned by the require-param-name Test.
// @evidence contracts/testing.md#execution-ownership The Test is a single Go unit with two direct helper calls; assertJSDocRuleLines parses the source with parseTSFile and runs the rule engine in the test process, with no installed consumer, native build or host.
func TestRuleJSDocRequireParamDescription(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-param-description", `/**
 * Handles a name.
 * @param name
 */
export function handle(name: string): string {
  return name;
}
`, 3)
  assertJSDocRuleLines(t, "jsdoc/require-param-description", "/**\n * Explains the declaration.\n * @param name Normalized display name.\n */\nexport function value(name: unknown): unknown { return name; }\n")
}
