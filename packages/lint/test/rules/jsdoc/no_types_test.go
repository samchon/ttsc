package linthost

import "testing"

// TestRuleJSDocNoTypes verifies jsdoc/no-types rejects duplicate TS types.
//
// @ttsc/lint only targets TypeScript sources here; parameter and return types
// already belong in syntax, so JSDoc type braces are redundant and can drift.
//
// 1. Parse a TypeScript file with a typed @param tag.
// 2. Enable jsdoc/no-types.
// 3. Assert the typed tag line is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines calls the actual engine and verifies typed @param is reported on line 3; exact rule, error severity and line checks detect missing, extra or misplaced findings.
// @evidence contracts/testing.md#independent-expectations TypeScript annotations already own parameter types; untyped JSDoc prose avoids duplicate type declarations. The literal comment and expected line establish this supported policy independently of the parser or rule result.
// @evidence contracts/testing.md#distinguishing-cases The deficient tag in the first source is the reported case, and a second independently authored block using @param name description must produce zero findings.
// @evidence contracts/testing.md#execution-ownership TestRuleJSDocNoTypes is a named Go unit entry running real comment parsing and the owning engine over virtual TypeScript in the shared test process, without an installed documentation consumer or host.
func TestRuleJSDocNoTypes(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/no-types", `/**
 * Handles a name.
 * @param {string} name description
 */
export function handle(name: string): string {
  return name;
}
`, 3)
  assertJSDocRuleLines(t, "jsdoc/no-types", "/**\n * Explains the declaration.\n * @param name description\n */\nexport function value(name: unknown): unknown { return name; }\n")
}
