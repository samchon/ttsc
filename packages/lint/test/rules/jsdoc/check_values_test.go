package linthost

import "testing"

// TestRuleJSDocCheckValues verifies jsdoc/check-values validates @access.
//
// The pragmatic JSDoc family only implements value checks whose valid sets are
// closed and cheap to validate. @access is one of those stable tags, so a typo
// must become a diagnostic without consulting the TypeScript checker.
//
// 1. Parse a TypeScript file with @access friend.
// 2. Enable jsdoc/check-values.
// 3. Assert the @access line is reported.
func TestRuleJSDocCheckValues(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/check-values", `/**
 * Creates a value.
 * @access friend
 */
export const value = 1;
`, 3)
}
