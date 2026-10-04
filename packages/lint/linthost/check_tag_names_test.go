package linthost

import "testing"

// TestRuleJSDocCheckTagNames verifies jsdoc/check-tag-names reports an unknown
// tag spelling and accepts the known spelling.
//
// The rule scans the JSDoc comment text directly, so the unknown tag is reported
// on its own comment line without depending on which declaration the comment
// attaches to.
//
// 1. Run the rule over a block whose third line is `@parm name description`
//    and expect one finding on line 3.
// 2. Run the rule over a block with `@param name description` and expect none.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines runs the registered jsdoc/check-tag-names rule through NewEngine.Run over a parsed virtual TypeScript file. The misspelled @parm yields exactly one finding, with that rule at error severity, on line 3; the separately authored block with @param yields none.
// @evidence contracts/testing.md#independent-expectations The supported parameter tag is @param, so @parm is unknown. The literal comment text and the expected line 3 are authored from that policy, not taken from the rule output. The Test does not assert the message text.
// @evidence contracts/testing.md#distinguishing-cases The authored @parm block reports and the separately authored @param block stays clean; their descriptions, function names and types also differ, so this is not a spelling-only mutation.
// @evidence contracts/testing.md#execution-ownership The Test is a single Go unit with two direct helper calls; assertJSDocRuleLines parses the source with parseTSFile and runs the rule engine in the test process, with no installed consumer, native build or host.
func TestRuleJSDocCheckTagNames(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/check-tag-names", `/**
 * Handles a name.
 * @parm name description
 */
export function handle(name: string): string {
  return name;
}
`, 3)
  assertJSDocRuleLines(t, "jsdoc/check-tag-names", "/**\n * Explains the declaration.\n * @param name description\n */\nexport function value(name: unknown): unknown { return name; }\n")
}
