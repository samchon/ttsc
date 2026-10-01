package linthost

import "testing"

// TestFormatWhitespaceStripsLeadingBlankLines verifies formatWhitespace
// removes blank lines at the start of the file.
//
// Prettier never keeps leading blank lines before the first token. This
// pins operation (c): the two empty lines preceding the first statement
// are removed.
//
//  1. Parse a file that opens with two blank lines.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the file now starts with the first statement.
//
// @evidence contracts/testing.md#behavioral-verification format/whitespace must remove two initial blank lines without changing the first declaration or final LF.
// @evidence contracts/testing.md#independent-expectations The independent output literal begins directly with const a=1 and preserves its terminator.
// @evidence contracts/testing.md#distinguishing-cases This changed leading block complements interior one-blank-line preservation and trailing/all-blank normalization.
// @evidence contracts/testing.md#execution-ownership TestFormatWhitespaceStripsLeadingBlankLines is a public Go unit selected by TestSelectedLintUnits. This host owns every literal input and assertion; the shared syntax-only harness invokes the whitespace rule and applies edits for complete output comparisons in the same process without a consumer install, native product build or product host.
func TestFormatWhitespaceStripsLeadingBlankLines(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/whitespace",
    "\n\nconst a = 1;\n",
    "const a = 1;\n",
  )
}
