package linthost

import "testing"

// TestRuleJSDocEmptyTags verifies jsdoc/empty-tags reports content after a
// marker tag and accepts the bare marker.
//
// Some JSDoc tags are boolean markers; the rule checks only whether such a tag
// carries text, so the result does not depend on comment attachment.
//
//  1. Run the rule over a block whose third line is `@async yes` and expect
//     one finding on line 3.
//  2. Run the rule over a block with a bare `@async` and expect none.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines runs the registered jsdoc/empty-tags rule through NewEngine.Run over a parsed virtual TypeScript file. `@async yes` yields exactly one finding, with that rule at error severity, on line 3; a bare `@async` yields none.
// @evidence contracts/testing.md#independent-expectations async is a marker tag that takes no content, so trailing text is a violation. The literal sources and the expected line 3 follow from that tag contract; the message text is not asserted.
// @evidence contracts/testing.md#distinguishing-cases The authored @async yes block reports and the separately authored bare @async block stays clean; their descriptions and declarations also differ. The other marker tags in the rule's table are not exercised by this Test.
// @evidence contracts/testing.md#execution-ownership The Test is a single Go unit with two direct helper calls; assertJSDocRuleLines parses the source with parseTSFile and runs the rule engine in the test process, with no installed consumer, native build or host.
func TestRuleJSDocEmptyTags(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/empty-tags", `/**
 * Loads data.
 * @async yes
 */
export async function load(): Promise<void> {}
`, 3)
  assertJSDocRuleLines(t, "jsdoc/empty-tags", "/**\n * Explains the declaration.\n * @async\n */\nexport function value(name: unknown): unknown { return name; }\n")
}
