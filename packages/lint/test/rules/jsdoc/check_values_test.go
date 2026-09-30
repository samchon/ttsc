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
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines calls the actual engine and verifies @access friend is reported on line 3; exact rule, error severity and line checks detect missing, extra or misplaced findings.
// @evidence contracts/testing.md#independent-expectations JSDoc access values use the defined visibility vocabulary; public is valid. The literal comment and expected line establish this supported policy independently of the parser or rule result.
// @evidence contracts/testing.md#distinguishing-cases The original malformed or incomplete tag remains intact; an independently authored documented block using @access public must produce zero findings.
// @evidence contracts/testing.md#execution-ownership TestRuleJSDocCheckValues is a named Go unit entry running real comment parsing and the owning engine over virtual TypeScript in the shared test process, without an installed documentation consumer or host.
func TestRuleJSDocCheckValues(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/check-values", `/**
 * Creates a value.
 * @access friend
 */
export const value = 1;
`, 3)
  assertJSDocRuleLines(t, "jsdoc/check-values", "/**\n * Explains the declaration.\n * @access public\n */\nexport function value(name: unknown): unknown { return name; }\n")
}
