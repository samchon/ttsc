package linthost

import "testing"

// TestFormatJSDocRewritesReturnToReturns verifies the canonical
// rewrite for the most common tag synonym.
//
// `@return` and `@returns` are interchangeable per JSDoc grammar but the
// canonical name is `@returns`. Tooling (TypeScript, IDE hovers,
// prettier-plugin-jsdoc) all prefer the canonical form, and projects
// usually contain mixed-style legacy comments. This scenario pins the
// rewrite so the formatter unifies the codebase.
//
// 1. Parse a source file with one JSDoc comment containing `@return`.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file uses `@returns`.
func TestFormatJSDocRewritesReturnToReturns(t *testing.T) {
  source := "/**\n * @return The user-facing message.\n */\nexport function greet(): string { return \"hi\"; }\n"
  expected := "/**\n * @returns The user-facing message.\n */\nexport function greet(): string { return \"hi\"; }\n"
  assertFixSnapshot(t, "format/jsdoc", source, expected)
}
