package linthost

import "testing"

// TestRuleJSDocRequireDescription verifies jsdoc/require-description reports a
// doc block that holds only tags and accepts the same block with prose.
//
// The rule is comment-local: a block with only tags does not explain the
// declaration regardless of which node the comment precedes.
//
// 1. Run the rule over a block whose only content is `@param name description`
//    and expect one finding on line 1, the opening line of the block.
// 2. Run the rule over a block that adds the prose line `Explains the
//    declaration.` before the same tag and expect none.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines runs the registered jsdoc/require-description rule through NewEngine.Run over a parsed virtual TypeScript file. The tag-only block yields exactly one finding, with that rule at error severity, on line 1 (the `/**` opener); the block with a prose line yields none.
// @evidence contracts/testing.md#independent-expectations A tag payload is not a description of the declaration, so only a prose line satisfies the rule. The literal sources and the expected opening line 1 follow from that policy; the message text is not asserted.
// @evidence contracts/testing.md#distinguishing-cases The two sources carry the same @param tag; only the added prose line separates a violation from a pass.
// @evidence contracts/testing.md#execution-ownership The Test is a single Go unit with two direct helper calls; assertJSDocRuleLines parses the source with parseTSFile and runs the rule engine in the test process, with no installed consumer, native build or host.
func TestRuleJSDocRequireDescription(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-description", `/**
 * @param name description
 */
export function handle(name: string): string {
  return name;
}
`, 1)
  assertJSDocRuleLines(t, "jsdoc/require-description", "/**\n * Explains the declaration.\n * @param name description\n */\nexport function value(name: unknown): unknown { return name; }\n")
}
