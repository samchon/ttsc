package linthost

import "testing"

// TestFormatWhitespaceSkipsEmptyFile verifies the rule emits no finding
// for an empty source file.
//
// An empty file has no whitespace to normalize and no content to anchor a
// final newline against, so the rule returns early. This pins that the
// zero-length guard produces no spurious edit.
//
//  1. Parse an empty source file.
//  2. Run the rule.
//  3. Assert it emits no finding.
//
// @evidence contracts/testing.md#behavioral-verification format/whitespace must offer no edit for zero-length source rather than inventing a final newline.
// @evidence contracts/testing.md#independent-expectations An independently specified truly empty file has no content or whitespace to normalize; zero findings is its observable oracle.
// @evidence contracts/testing.md#distinguishing-cases The empty negative contrasts with nonempty whitespace-only LF/CRLF sources that must change and visible content requiring an EOL.
// @evidence contracts/testing.md#execution-ownership TestFormatWhitespaceSkipsEmptyFile is a public Go unit selected by TestSelectedLintUnits. This host owns every literal input and assertion; the shared syntax-only harness invokes the whitespace rule and observes zero findings in the same process without a consumer install, native product build or product host.
func TestFormatWhitespaceSkipsEmptyFile(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/whitespace",
    "",
  )
}
