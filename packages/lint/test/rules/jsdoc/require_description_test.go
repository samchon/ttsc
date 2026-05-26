package linthost

import "testing"

// TestRuleJSDocRequireDescription verifies jsdoc/require-description rejects tag-only blocks.
//
// The rule is intentionally comment-local: a doc block with only tags does not
// explain the declaration, regardless of which AST node the comment precedes.
//
// 1. Parse a TypeScript file with a tag-only JSDoc block.
// 2. Enable jsdoc/require-description.
// 3. Assert the block start is reported.
func TestRuleJSDocRequireDescription(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-description", `/**
 * @param name description
 */
export function handle(name: string): string {
  return name;
}
`, 1)
}
