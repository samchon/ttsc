package linthost

import "testing"

// TestRuleJSDocCheckTagNames verifies jsdoc/check-tag-names reports unknown tags.
//
// This pins the source-level JSDoc parser to real comment trivia instead of
// arbitrary source text. Unknown tag spelling is independent of AST attachment,
// so the rule should fire directly on the offending tag line.
//
// 1. Parse a TypeScript file with one JSDoc block.
// 2. Enable jsdoc/check-tag-names.
// 3. Assert the misspelled tag line is reported.
func TestRuleJSDocCheckTagNames(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/check-tag-names", `/**
 * Handles a name.
 * @parm name description
 */
export function handle(name: string): string {
  return name;
}
`, 3)
}
