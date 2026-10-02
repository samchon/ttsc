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
//
// @evidence contracts/testing.md#behavioral-verification format/statement-split must offer no edit for two same-line statements separated by a block comment, preventing gap replacement from deleting that comment.
// @evidence contracts/testing.md#independent-expectations The literal c comment lies between two complete declarations; preserving its bytes is independent of the whitespace insertion algorithm.
// @evidence contracts/testing.md#distinguishing-cases This full-gap comment negative complements comment-free same-line splitting and separately indented block statements; it observes no finding for this one source.
// @evidence contracts/testing.md#execution-ownership TestFormatStatementSplitAbstainsWhenBlockCommentInGap is selected by the lint semantic-unit Evidence claim as a public Go unit. The owning formatter rule runs through the shared syntax-only rule harness on temporary fixture source; this entry owns its assertions and any named subtests without consumer installation, native product build or host process.
func TestFormatStatementSplitAbstainsWhenBlockCommentInGap(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/statement-split",
    "const a = 1; /*c*/ const b = 2;\n",
  )
}
