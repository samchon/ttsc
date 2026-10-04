package linthost

import "testing"

// TestRuleJSDocRequirePropertyName verifies jsdoc/require-property-name reports
// a @property that has only a type and accepts one that names the property.
//
// 1. Run the rule over a block whose third line is `@property {string}` and
//    expect one finding on line 3.
// 2. Run the rule over a block with `@property {string} name description` and expect none.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines runs the registered jsdoc/require-property-name rule through NewEngine.Run over a parsed virtual TypeScript file. `@property {string}` yields exactly one finding, with that rule at error severity, on line 3; `@property {string} name description` yields none.
// @evidence contracts/testing.md#independent-expectations A type alone cannot identify the documented property. The literal sources and expected line 3 follow from that policy; the message text is not asserted.
// @evidence contracts/testing.md#distinguishing-cases The authored type-only property tag reports and the separately authored named tag stays clean while both retain {string}; their block prose and TypeScript declarations also differ.
// @evidence contracts/testing.md#execution-ownership The Test is a single Go unit with two direct helper calls; assertJSDocRuleLines parses the source with parseTSFile and runs the rule engine in the test process, with no installed consumer, native build or host.
func TestRuleJSDocRequirePropertyName(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-property-name", `/**
 * Options bag.
 * @property {string}
 */
export interface Options {
  name: string;
}
`, 3)
  assertJSDocRuleLines(t, "jsdoc/require-property-name", "/**\n * Explains the declaration.\n * @property {string} name description\n */\nexport function value(name: unknown): unknown { return name; }\n")
}
