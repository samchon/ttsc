package linthost

import "testing"

// TestRuleJSDocCheckTagNames verifies jsdoc/check-tag-names reports unknown tags.
//
// This pins the source-level JSDoc parser to real comment trivia instead of
// arbitrary source text. Unknown tag spelling is independent of AST attachment,
// so the rule should fire directly on the offending tag line.
//
// 1. Parse a TypeScript file with one JSDoc block.
// 2. Enable jsdoc/check-tag-names.
// 3. Assert the misspelled tag line is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines calls the actual engine and verifies misspelled @parm is reported on line 3; exact rule, error severity and line checks detect missing, extra or misplaced findings.
// @evidence contracts/testing.md#independent-expectations The supported parameter tag is @param; a misspelling is not a known tag. The literal comment and expected line establish this supported policy independently of the parser or rule result.
// @evidence contracts/testing.md#distinguishing-cases The original malformed or incomplete tag remains intact; an independently authored documented block using @param name description must produce zero findings.
// @evidence contracts/testing.md#execution-ownership TestRuleJSDocCheckTagNames is a named Go unit entry running real comment parsing and the owning engine over virtual TypeScript in the shared test process, without an installed documentation consumer or host.
func TestRuleJSDocCheckTagNames(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/check-tag-names", `/**
 * Handles a name.
 * @parm name description
 */
export function handle(name: string): string {
  return name;
}
`, 3)
  assertJSDocRuleLines(t, "jsdoc/check-tag-names", "/**\n * Explains the declaration.\n * @param name description\n */\nexport function value(name: unknown): unknown { return name; }\n")
}
