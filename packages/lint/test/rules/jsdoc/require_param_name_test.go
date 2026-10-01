package linthost

import "testing"

// TestRuleJSDocRequireParamName verifies jsdoc/require-param-name.
//
// TypeScript source comments can still contain JSDoc type braces. When the tag
// has only a type payload, the parameter name is missing and the rule reports it.
//
// 1. Parse a TypeScript file with @param {string}.
// 2. Enable jsdoc/require-param-name.
// 3. Assert the @param line is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines calls the actual engine and verifies @param {string} without a name is reported on line 3; exact rule, error severity and line checks detect missing, extra or misplaced findings.
// @evidence contracts/testing.md#independent-expectations A type alone cannot identify the documented parameter. The literal comment and expected line establish this supported policy independently of the parser or rule result.
// @evidence contracts/testing.md#distinguishing-cases The deficient tag in the first source is the reported case, and a second independently authored block using @param {string} name description must produce zero findings.
// @evidence contracts/testing.md#execution-ownership TestRuleJSDocRequireParamName is a named Go unit entry running real comment parsing and the owning engine over virtual TypeScript in the shared test process, without an installed documentation consumer or host.
func TestRuleJSDocRequireParamName(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-param-name", `/**
 * Handles a name.
 * @param {string}
 */
export function handle(name: string): string {
  return name;
}
`, 3)
  assertJSDocRuleLines(t, "jsdoc/require-param-name", "/**\n * Explains the declaration.\n * @param {string} name description\n */\nexport function value(name: unknown): unknown { return name; }\n")
}
