package linthost

import "testing"

// TestRuleJSDocRequirePropertyDescription verifies jsdoc/require-property-description.
//
// Property docs are often attached to typedef blocks rather than AST members.
// A comment-only rule catches missing property prose without needing attachment.
//
// 1. Parse a TypeScript file with @property name and no description.
// 2. Enable jsdoc/require-property-description.
// 3. Assert the @property line is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines calls the actual engine and verifies @property name without prose is reported on line 3; exact rule, error severity and line checks detect missing, extra or misplaced findings.
// @evidence contracts/testing.md#independent-expectations A property identifier needs explanatory text. The literal comment and expected line establish this supported policy independently of the parser or rule result.
// @evidence contracts/testing.md#distinguishing-cases The deficient tag in the first source is the reported case, and a second independently authored block using @property name Human-readable option name. must produce zero findings.
// @evidence contracts/testing.md#execution-ownership TestRuleJSDocRequirePropertyDescription is a named Go unit entry running real comment parsing and the owning engine over virtual TypeScript in the shared test process, without an installed documentation consumer or host.
func TestRuleJSDocRequirePropertyDescription(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-property-description", `/**
 * Options bag.
 * @property name
 */
export interface Options {
  name: string;
}
`, 3)
  assertJSDocRuleLines(t, "jsdoc/require-property-description", "/**\n * Explains the declaration.\n * @property name Human-readable option name.\n */\nexport function value(name: unknown): unknown { return name; }\n")
}
