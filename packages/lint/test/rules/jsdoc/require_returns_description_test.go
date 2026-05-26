package linthost

import "testing"

// TestRuleJSDocRequireReturnsDescription verifies jsdoc/require-returns-description.
//
// Return docs without prose add little signal for readers or AI-generated
// harnesses. The rule validates the tag payload directly from the comment line.
//
// 1. Parse a TypeScript file with a bare @returns tag.
// 2. Enable jsdoc/require-returns-description.
// 3. Assert the @returns line is reported.
func TestRuleJSDocRequireReturnsDescription(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-returns-description", `/**
 * Computes a value.
 * @returns {number}
 */
export function compute(): number {
  return 1;
}
`, 3)
}
