package linthost

import "testing"

// TestFormatIndentDefersSharedLineToStatementSplit verifies the rule
// abstains on a statement that shares a line with a preceding statement.
//
// A statement that is not the first token on its line is
// `format/statement-split`'s surface; reindenting it here would overlap
// that rule's edit on one cascade pass. Keeping the two rules disjoint
// leaves the later statement untouched while the line-leading statement can
// still have its indentation corrected. This pins that ownership boundary.
//
//  1. Parse correctly indented and over-indented shared lines inside a block.
//  2. Run the rule.
//  3. Assert the correct input emits no findings and only the other line's
//     leading indentation changes, retaining its second statement.
//
// @evidence contracts/testing.md#behavioral-verification format/indent must leave the original correctly indented shared line alone and correct only its leading indentation when the same first statement is over-indented. Complete output preserves the second statement on that line for statement-split ownership.
// @evidence contracts/testing.md#independent-expectations The supported two-space function-body layout determines the leading replacement independently of edit calculations. Splitting the second const declaration belongs to the sibling rule, so its literal token sequence and separating gap remain unchanged.
// @evidence contracts/testing.md#distinguishing-cases The original no-finding case stays, and an otherwise identical six-space line is a positive requiring two spaces. Together they distinguish ceding the later statement from incorrectly skipping the whole shared line.
// @evidence contracts/testing.md#execution-ownership TestFormatIndentDefersSharedLineToStatementSplit owns both literal fixtures and their separate skip/output assertions in the public Go unit population. The syntax-only harness runs the owning rule and edit application in process without consumer installation, native building or a real product host.
func TestFormatIndentDefersSharedLineToStatementSplit(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/indent",
    "function f() {\n  const a = 1; const b = 2;\n}\n",
  )
  assertFixSnapshot(t, "format/indent",
    "function f() {\n      const a = 1; const b = 2;\n}\n",
    "function f() {\n  const a = 1; const b = 2;\n}\n")
}
