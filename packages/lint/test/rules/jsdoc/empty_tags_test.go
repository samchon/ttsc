package linthost

import "testing"

// TestRuleJSDocEmptyTags verifies jsdoc/empty-tags rejects content on empty tags.
//
// Some JSDoc tags are boolean markers. Keeping this as a content-only check
// makes the rule deterministic across TypeScript-Go comment attachment changes.
//
// 1. Parse a TypeScript file with an @async marker carrying text.
// 2. Enable jsdoc/empty-tags.
// 3. Assert the marker line is reported.
func TestRuleJSDocEmptyTags(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/empty-tags", `/**
 * Loads data.
 * @async yes
 */
export async function load(): Promise<void> {}
`, 3)
}
