package linthost

import "testing"

// TestFormatWhitespaceStripsTrailingBlankLines verifies formatWhitespace
// removes trailing blank lines and leaves exactly one final newline.
//
// Prettier ends a file with a single newline. This pins operation (d):
// the trailing blank lines and stray whitespace after the last statement
// collapse to one EOL.
//
//  1. Parse a statement followed by several blank/whitespace-only lines.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the file ends with one newline after the statement.
//
// @evidence contracts/testing.md#behavioral-verification format/whitespace must reduce trailing empty/space-only lines to one final LF while keeping the declaration intact.
// @evidence contracts/testing.md#independent-expectations The complete literal output independently specifies exactly one terminal newline after const a=1.
// @evidence contracts/testing.md#distinguishing-cases Multiple empty lines and a whitespace-only final line change; missing-EOL and all-blank sources own the neighboring EOF decisions.
// @evidence contracts/testing.md#execution-ownership TestFormatWhitespaceStripsTrailingBlankLines is a public Go unit selected by TestSelectedLintUnits. This host owns every literal input and assertion; the shared syntax-only harness invokes the whitespace rule and applies edits for complete output comparisons in the same process without a consumer install, native product build or product host.
func TestFormatWhitespaceStripsTrailingBlankLines(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/whitespace",
    "const a = 1;\n\n\n  \n",
    "const a = 1;\n",
  )
}
