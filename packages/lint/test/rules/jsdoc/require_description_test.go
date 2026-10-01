package linthost

import "testing"

// TestRuleJSDocRequireDescription verifies jsdoc/require-description rejects tag-only blocks.
//
// The rule is intentionally comment-local: a doc block with only tags does not
// explain the declaration, regardless of which AST node the comment precedes.
//
// 1. Parse a TypeScript file with a tag-only JSDoc block.
// 2. Enable jsdoc/require-description.
// 3. Assert the block start is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines calls the actual engine and verifies a tag-only block is reported at its opening line; exact rule, error severity and line checks detect missing, extra or misplaced findings.
// @evidence contracts/testing.md#independent-expectations Tag payload is not a declaration description; a prose line supplies the missing description. The literal comment and expected line establish this supported policy independently of the parser or rule result.
// @evidence contracts/testing.md#distinguishing-cases The deficient tag in the first source is the reported case, and a second independently authored block using @param name description must produce zero findings.
// @evidence contracts/testing.md#execution-ownership TestRuleJSDocRequireDescription is a named Go unit entry running real comment parsing and the owning engine over virtual TypeScript in the shared test process, without an installed documentation consumer or host.
func TestRuleJSDocRequireDescription(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-description", `/**
 * @param name description
 */
export function handle(name: string): string {
  return name;
}
`, 1)
  assertJSDocRuleLines(t, "jsdoc/require-description", "/**\n * Explains the declaration.\n * @param name description\n */\nexport function value(name: unknown): unknown { return name; }\n")
}
