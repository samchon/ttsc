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
func TestFormatStatementSplitKeepsBlockOnCaseLabelLine(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/statement-split",
    "switch (x) {\n  case 2: {\n    break;\n  }\n}\n",
  )
}
