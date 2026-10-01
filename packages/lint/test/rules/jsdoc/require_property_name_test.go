package linthost

import "testing"

// TestRuleJSDocRequirePropertyName verifies jsdoc/require-property-name.
//
// A @property tag with only a type cannot be matched to generated docs. The
// native rule therefore treats it as a malformed tag line.
//
// 1. Parse a TypeScript file with @property {string}.
// 2. Enable jsdoc/require-property-name.
// 3. Assert the @property line is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines calls the actual engine and verifies @property {string} without a name is reported on line 3; exact rule, error severity and line checks detect missing, extra or misplaced findings.
// @evidence contracts/testing.md#independent-expectations A type alone cannot identify the documented property. The literal comment and expected line establish this supported policy independently of the parser or rule result.
// @evidence contracts/testing.md#distinguishing-cases The deficient tag in the first source is the reported case, and a second independently authored block using @property {string} name description must produce zero findings.
// @evidence contracts/testing.md#execution-ownership TestRuleJSDocRequirePropertyName is a named Go unit entry running real comment parsing and the owning engine over virtual TypeScript in the shared test process, without an installed documentation consumer or host.
func TestRuleJSDocRequirePropertyName(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-property-name", `/**
 * Options bag.
 * @property {string}
 */
export interface Options {
  name: string;
}
`, 3)
  assertJSDocRuleLines(t, "jsdoc/require-property-name", "/**\n * Explains the declaration.\n * @property {string} name description\n */\nexport function value(name: unknown): unknown { return name; }\n")
}
