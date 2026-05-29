package linthost

import "testing"

// TestFormatIndentDefersSharedLineToStatementSplit verifies the rule
// abstains on a statement that shares a line with a preceding statement.
//
// A statement that is not the first token on its line is
// `format/statement-split`'s surface; reindenting it here would overlap
// that rule's edit on one cascade pass. Keeping the two rules disjoint
// means `format/indent` emits nothing for a crammed line. This pins that
// deferral.
//
//  1. Parse two statements sharing one indented line inside a block.
//  2. Run the rule.
//  3. Assert it emits no finding (the second statement is split's job).
func TestFormatIndentDefersSharedLineToStatementSplit(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/indent",
    "function f() {\n  const a = 1; const b = 2;\n}\n",
  )
}
