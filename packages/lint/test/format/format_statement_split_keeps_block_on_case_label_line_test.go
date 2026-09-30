package linthost

import "testing"

// TestFormatStatementSplitKeepsBlockOnCaseLabelLine verifies the rule
// leaves a `case X: {` block attached to its clause label.
//
// A block that opens right after its own `case`/`default` label is not
// sharing a line with a preceding statement; the only thing before it is
// the label. Prettier keeps the brace on the label line, so the rule must
// abstain instead of breaking it off into `case 2:\n{`. This pins the
// `firstStatementAfterCaseLabel` guard.
//
//  1. Parse a switch whose case clause opens a block on the label line.
//  2. Run the rule.
//  3. Assert it emits no finding (block stays on the label line).
//
// @evidence contracts/testing.md#behavioral-verification format/statement-split must offer no finding for a block attached to case two rather than detaching its brace from its own clause label.
// @evidence contracts/testing.md#independent-expectations The literal switch case owns the following block, not a preceding statement; the case-label formatting convention permits that attachment independently from the split walk.
// @evidence contracts/testing.md#distinguishing-cases This case-label negative complements actual same-line statement splitting and nested-body splitting, distinguishing a label-owned block from a second statement.
// @evidence contracts/testing.md#execution-ownership TestFormatStatementSplitKeepsBlockOnCaseLabelLine is a public Go unit selected by TestSelectedLintUnits. Its shared syntax-only harness invokes the owning formatter on temporary fixture source and observes its no-finding result in the same process, without a consumer install, native product build or host execution.
func TestFormatStatementSplitKeepsBlockOnCaseLabelLine(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/statement-split",
    "switch (x) {\n  case 2: {\n    break;\n  }\n}\n",
  )
}
