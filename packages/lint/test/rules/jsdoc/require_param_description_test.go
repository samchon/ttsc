package linthost

import "testing"

// TestRuleJSDocRequireParamDescription verifies jsdoc/require-param-description.
//
// The parser splits the optional type, parameter name, and trailing description
// from a single tag line. A named @param with no remaining description must fail.
//
// 1. Parse a TypeScript file with @param name and no description.
// 2. Enable jsdoc/require-param-description.
// 3. Assert the @param line is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines calls the actual engine and verifies @param name without prose is reported on line 3; exact rule, error severity and line checks detect missing, extra or misplaced findings.
// @evidence contracts/testing.md#independent-expectations A parameter name identifies the target, but description text explains it. The literal comment and expected line establish this supported policy independently of the parser or rule result.
// @evidence contracts/testing.md#distinguishing-cases The original malformed or incomplete tag remains intact; an independently authored documented block using @param name Normalized display name. must produce zero findings.
// @evidence contracts/testing.md#execution-ownership TestRuleJSDocRequireParamDescription is a named Go unit entry running real comment parsing and the owning engine over virtual TypeScript in the shared test process, without an installed documentation consumer or host.
func TestRuleJSDocRequireParamDescription(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-param-description", `/**
 * Handles a name.
 * @param name
 */
export function handle(name: string): string {
  return name;
}
`, 3)
  assertJSDocRuleLines(t, "jsdoc/require-param-description", "/**\n * Explains the declaration.\n * @param name Normalized display name.\n */\nexport function value(name: unknown): unknown { return name; }\n")
}
