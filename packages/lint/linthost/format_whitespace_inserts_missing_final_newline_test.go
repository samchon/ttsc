package linthost

import "testing"

// TestFormatWhitespaceInsertsMissingFinalNewline verifies
// formatWhitespace appends a final newline to a file that ends without
// one.
//
// Prettier guarantees a trailing newline. This pins the no-newline arm
// of operation (d): a file whose last byte is a statement terminator
// gains exactly one EOL.
//
//  1. Parse a single statement with no terminating newline.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the file now ends with one newline.
//
// @evidence contracts/testing.md#behavioral-verification format/whitespace must append exactly one LF to content ending at its statement semicolon.
// @evidence contracts/testing.md#independent-expectations The complete literal output differs only by its required terminal LF and retains the declaration.
// @evidence contracts/testing.md#distinguishing-cases This changed EOF boundary complements trailing-space-plus-missing-EOL normalization, clean sources and the empty-file negative.
// @evidence contracts/testing.md#execution-ownership TestFormatWhitespaceInsertsMissingFinalNewline is a public Go unit selected by TestSelectedLintUnits. This host owns every literal input and assertion; the shared syntax-only harness invokes the whitespace rule and applies edits for complete output comparisons in the same process without a consumer install, native product build or product host.
func TestFormatWhitespaceInsertsMissingFinalNewline(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/whitespace",
    "const a = 1;",
    "const a = 1;\n",
  )
}
