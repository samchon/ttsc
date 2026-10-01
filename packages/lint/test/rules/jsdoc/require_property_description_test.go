package linthost

import "testing"

// TestRuleJSDocRequirePropertyDescription verifies
// jsdoc/require-property-description reports a named @property without a
// description and accepts one with prose.
//
// Property docs often sit in typedef blocks rather than on members, so the rule
// reads only the comment text.
//
// 1. Run the rule over a block whose third line is `@property name` and
//    expect one finding on line 3.
// 2. Run the rule over a block with `@property name Human-readable option name.` and expect none.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines runs the registered jsdoc/require-property-description rule through NewEngine.Run over a parsed virtual TypeScript file. `@property name` yields exactly one finding, with that rule at error severity, on line 3; `@property name Human-readable option name.` yields none.
// @evidence contracts/testing.md#independent-expectations A property name identifies the target and the description explains it, so a name alone is incomplete. The literal sources and expected line 3 follow from that policy; the message text is not asserted.
// @evidence contracts/testing.md#distinguishing-cases The two sources differ only in the trailing description text. The wrapped-description case is owned by the multiline-continuation Test, and a nameless @property by the require-property-name Test.
// @evidence contracts/testing.md#execution-ownership The Test is a single Go unit with two direct helper calls; assertJSDocRuleLines parses the source with parseTSFile and runs the rule engine in the test process, with no installed consumer, native build or host.
func TestRuleJSDocRequirePropertyDescription(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-property-description", `/**
 * Options bag.
 * @property name
 */
export interface Options {
  name: string;
}
`, 3)
  assertJSDocRuleLines(t, "jsdoc/require-property-description", "/**\n * Explains the declaration.\n * @property name Human-readable option name.\n */\nexport function value(name: unknown): unknown { return name; }\n")
}
