package linthost

import "testing"

// TestFormatIndentNormalizesSwitchCaseBodyDepth verifies a switch case
// body lands at depth 2 (four spaces) under the default tabWidth.
//
// The AST is SwitchStatement -> CaseBlock -> CaseClause -> statements.
// CaseBlock is a descend-only +1 frame and the clause adds another +1, so
// a top-level case-body statement sits at switchDepth+2. Without the
// CaseBlock frame the body would land one indentation level short. This pins the
// off-by-one fix.
//
//  1. Parse a top-level switch whose case body is flush left.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the body statement is re-indented to four spaces.
//
// @evidence contracts/testing.md#behavioral-verification format/indent must move the flush-left break inside a switch case to four spaces. Complete source detects failing to account for the switch case-body level and retains the case selector and break semantics.
// @evidence contracts/testing.md#independent-expectations The supported switch layout places case labels at two spaces and their statements at four. The literal expected break column is independent of the implementation frame traversal.
// @evidence contracts/testing.md#distinguishing-cases This positive has an unbraced case-body statement at column zero. CaseBlockBodyMatchesCaseDepth covers a same-line explicit block that must not add another level.
// @evidence contracts/testing.md#execution-ownership TestFormatIndentNormalizesSwitchCaseBodyDepth owns its literal fixture in the public Go unit population. The owning syntax-only rule and edit application execute in process without installing a consumer, building native artifacts or starting a real product host.
func TestFormatIndentNormalizesSwitchCaseBodyDepth(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/indent",
    "switch (x) {\n  case 1:\nbreak;\n}\n",
    "switch (x) {\n  case 1:\n    break;\n}\n",
  )
}
