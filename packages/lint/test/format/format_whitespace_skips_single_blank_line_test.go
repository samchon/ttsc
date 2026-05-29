package linthost

import "testing"

// TestFormatWhitespaceSkipsSingleBlankLine verifies the rule preserves a
// single interior blank line between two statements.
//
// Prettier keeps at most one consecutive blank line; exactly one is
// allowed, so the collapse pass must not fire. This pins that a file with
// one interior blank line is a fixed point.
//
//  1. Parse two statements separated by one blank line.
//  2. Run the rule.
//  3. Assert it emits no finding.
func TestFormatWhitespaceSkipsSingleBlankLine(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/whitespace",
    "const a = 1;\n\nconst b = 2;\n",
  )
}
