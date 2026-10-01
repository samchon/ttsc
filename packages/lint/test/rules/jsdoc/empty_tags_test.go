package linthost

import "testing"

// TestRuleJSDocEmptyTags verifies jsdoc/empty-tags rejects content on empty tags.
//
// Some JSDoc tags are boolean markers. Keeping this as a content-only check
// makes the rule deterministic across TypeScript-Go comment attachment changes.
//
// 1. Parse a TypeScript file with an @async marker carrying text.
// 2. Enable jsdoc/empty-tags.
// 3. Assert the marker line is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines calls the actual engine and verifies @async yes is reported on line 3; exact rule, error severity and line checks detect missing, extra or misplaced findings.
// @evidence contracts/testing.md#independent-expectations async is a marker tag without content. The literal comment and expected line establish this supported policy independently of the parser or rule result.
// @evidence contracts/testing.md#distinguishing-cases The deficient tag in the first source is the reported case, and a second independently authored block using @async must produce zero findings.
// @evidence contracts/testing.md#execution-ownership TestRuleJSDocEmptyTags is a named Go unit entry running real comment parsing and the owning engine over virtual TypeScript in the shared test process, without an installed documentation consumer or host.
func TestRuleJSDocEmptyTags(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/empty-tags", `/**
 * Loads data.
 * @async yes
 */
export async function load(): Promise<void> {}
`, 3)
  assertJSDocRuleLines(t, "jsdoc/empty-tags", "/**\n * Explains the declaration.\n * @async\n */\nexport function value(name: unknown): unknown { return name; }\n")
}
