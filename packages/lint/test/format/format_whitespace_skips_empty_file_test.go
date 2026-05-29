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
func TestFormatWhitespaceSkipsEmptyFile(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/whitespace",
    "",
  )
}
