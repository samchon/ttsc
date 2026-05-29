package linthost

import "testing"

// TestFormatStatementSplitAbstainsWhenBlockCommentInGap verifies the rule
// abstains when a block comment sits in the inter-statement gap.
//
// Re-emitting EOL + indent over `const a = 1; /*c*/ const b = 2;` would
// delete the `/*c*/` comment. The abstain scans the full gap from the
// previous statement's end, not just the immediate whitespace run (a
// comment is non-whitespace and never lives in that run). This pins the
// regression where `gapHasComment` scanned a slice that could never hold
// the comment.
//
//  1. Parse two statements on one line with a block comment between them.
//  2. Run the rule.
//  3. Assert it emits no finding.
func TestFormatStatementSplitAbstainsWhenBlockCommentInGap(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/statement-split",
    "const a = 1; /*c*/ const b = 2;\n",
  )
}
