package linthost

import "testing"

// TestRuleJSDocNoTypes verifies jsdoc/no-types reports a type brace on a
// @param tag and accepts the untyped tag.
//
// Parameter and return types already belong in TypeScript syntax, so a JSDoc
// type brace duplicates them and can drift.
//
// 1. Run the rule over a block whose third line is `@param {string} name
//    description` and expect one finding on line 3.
// 2. Run the rule over a block with `@param name description` and expect none.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines runs the registered jsdoc/no-types rule through NewEngine.Run over a parsed virtual TypeScript file. The typed @param yields exactly one finding, with that rule at error severity, on line 3; the untyped @param yields none.
// @evidence contracts/testing.md#independent-expectations TypeScript annotations own the types of TypeScript sources, so a JSDoc type brace is redundant. The literal sources and expected line 3 follow from that policy; the message text is not asserted.
// @evidence contracts/testing.md#distinguishing-cases The authored typed @param block reports and the separately authored untyped @param block stays clean; their descriptions, function names and TypeScript types also differ. Other typed tags in the rule's table (@returns, @property, ...) are not exercised by this Test.
// @evidence contracts/testing.md#execution-ownership The Test is a single Go unit with two direct helper calls; assertJSDocRuleLines parses the source with parseTSFile and runs the rule engine in the test process, with no installed consumer, native build or host.
func TestRuleJSDocNoTypes(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/no-types", `/**
 * Handles a name.
 * @param {string} name description
 */
export function handle(name: string): string {
  return name;
}
`, 3)
  assertJSDocRuleLines(t, "jsdoc/no-types", "/**\n * Explains the declaration.\n * @param name description\n */\nexport function value(name: unknown): unknown { return name; }\n")
}
