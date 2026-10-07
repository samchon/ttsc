package linthost

import "testing"

// TestFormatJSDocRewritesReturnToReturns verifies the canonical
// rewrite for the most common tag synonym.
//
// `@return` and `@returns` are interchangeable per JSDoc grammar but the
// canonical name is `@returns`. The formatter uses that spelling while
// retaining the documented return description and the program bytes.
//
// 1. Parse a source file with one JSDoc comment containing `@return`.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file uses `@returns`.
//
// @evidence contracts/testing.md#behavioral-verification The owning JSDoc rule must change return to returns and retain its description and function bytes. The complete output distinguishes missing normalization or editing tag content beyond its name.
// @evidence contracts/testing.md#independent-expectations Official JSDoc return documentation names returns as the canonical tag with return as its alias. That supported spelling independently determines the literal output.
// @evidence contracts/testing.md#distinguishing-cases This singleton return alias is a positive. SkipsCanonicalTags supplies the already-returns negative and PreservesExampleBlockBody distinguishes the same alias inside sample content.
// @evidence contracts/testing.md#execution-ownership TestFormatJSDocRewritesReturnToReturns owns its literal source/output in the public Go unit population. The syntax-only owning operation and edit harness execute in process without consumer installation, native artifact production or a real product host.
func TestFormatJSDocRewritesReturnToReturns(t *testing.T) {
  source := "/**\n * @return The user-facing message.\n */\nexport function greet(): string { return \"hi\"; }\n"
  expected := "/**\n * @returns The user-facing message.\n */\nexport function greet(): string { return \"hi\"; }\n"
  assertFixSnapshot(t, "format/jsdoc", source, expected)
}
