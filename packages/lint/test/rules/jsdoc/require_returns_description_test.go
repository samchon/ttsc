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
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines calls the actual engine and verifies @returns {number} without prose is reported on line 3; exact rule, error severity and line checks detect missing, extra or misplaced findings.
// @evidence contracts/testing.md#independent-expectations A result type does not explain the returned value. The literal comment and expected line establish this supported policy independently of the parser or rule result.
// @evidence contracts/testing.md#distinguishing-cases The original malformed or incomplete tag remains intact; an independently authored documented block using @returns {number} Rounded total. must produce zero findings.
// @evidence contracts/testing.md#execution-ownership TestRuleJSDocRequireReturnsDescription is a named Go unit entry running real comment parsing and the owning engine over virtual TypeScript in the shared test process, without an installed documentation consumer or host.
func TestRuleJSDocRequireReturnsDescription(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-returns-description", `/**
 * Computes a value.
 * @returns {number}
 */
export function compute(): number {
  return 1;
}
`, 3)
  assertJSDocRuleLines(t, "jsdoc/require-returns-description", "/**\n * Explains the declaration.\n * @returns {number} Rounded total.\n */\nexport function value(name: unknown): unknown { return name; }\n")
}
