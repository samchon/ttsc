package linthost

import "testing"

// TestFormatIndentNormalizesSwitchCaseBodyDepth verifies a switch case
// body lands at depth 2 (four spaces) under the default tabWidth.
//
// The AST is SwitchStatement -> CaseBlock -> CaseClause -> statements.
// CaseBlock is a descend-only +1 frame and the clause adds another +1, so
// a top-level case-body statement sits at switchDepth+2. Without the
// CaseBlock frame the body would land one column short. This pins the
// off-by-one fix.
//
//  1. Parse a top-level switch whose case body is flush left.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the body statement is re-indented to four spaces.
func TestFormatIndentNormalizesSwitchCaseBodyDepth(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/indent",
    "switch (x) {\n  case 1:\nbreak;\n}\n",
    "switch (x) {\n  case 1:\n    break;\n}\n",
  )
}
