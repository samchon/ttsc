package linthost

import "testing"

// TestFormatWhitespaceCollapsesConsecutiveBlankLines verifies
// formatWhitespace collapses a run of multiple blank lines between two
// statements to exactly one blank line.
//
// Prettier keeps at most one consecutive blank line. This pins operation
// (b): three blank lines between two statements become one.
//
//  1. Parse two statements separated by three blank lines.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert exactly one blank line remains between them.
//
// @evidence contracts/testing.md#behavioral-verification format/whitespace must reduce three interior blank lines to exactly one while retaining declaration order and payload.
// @evidence contracts/testing.md#independent-expectations The independently authored full output permits one blank line and preserves a=1 followed by b=2.
// @evidence contracts/testing.md#distinguishing-cases The over-threshold positive complements the exactly-one negative and protected template blank runs.
// @evidence contracts/testing.md#execution-ownership TestFormatWhitespaceCollapsesConsecutiveBlankLines is a public Go unit selected by TestSelectedLintUnits. This host owns every literal input and assertion; the shared syntax-only harness invokes the whitespace rule and applies edits for complete output comparisons in the same process without a consumer install, native product build or product host.
func TestFormatWhitespaceCollapsesConsecutiveBlankLines(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/whitespace",
    "const a = 1;\n\n\n\nconst b = 2;\n",
    "const a = 1;\n\nconst b = 2;\n",
  )
}
