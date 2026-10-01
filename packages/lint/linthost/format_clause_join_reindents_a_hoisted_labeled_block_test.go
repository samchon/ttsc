package linthost

import "testing"

// TestFormatClauseJoinReindentsAHoistedLabeledBlock verifies a hoisted labeled statement carries its block body to the new column.
//
// The label is the other clause that hoists a multi-line body, and the one that
// hoists a braced one. Its interior and its closing brace both sit a level deeper
// than the label line before the join and have to travel with it.
//
//  1. Parse a label whose indented loop body spans several lines.
//  2. Apply format/clause-join with printWidth 80.
//  3. Assert the loop joins the label line and its interior moves with it.
//
// @evidence contracts/testing.md#behavioral-verification Clause-join must hoist the labeled for-of statement and outdent both the loop interior and closing brace. The complete source snapshot catches moving only the header or dropping a continuation edit.
// @evidence contracts/testing.md#independent-expectations The supported label layout removes the extra indentation formerly below outer: while retaining the loop body one level inside its braces. Literal output preserves the visit expression and binding exactly.
// @evidence contracts/testing.md#distinguishing-cases This positive starts the labeled loop two columns deeper than the label, unlike EmitsNoShiftWhenTheColumnIsUnchanged. JoinsLabeledBlockBody additionally covers an actual Block body rather than a loop containing a block.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinReindentsAHoistedLabeledBlock owns the literal transformation fixture in the public Go unit population. The syntax-only owning rule and edit application run in process without consumer installation, native building or an actual product host.
func TestFormatClauseJoinReindentsAHoistedLabeledBlock(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/clause-join",
    "outer:\n  for (const item of items) {\n    visit(item);\n  }\n",
    `{"printWidth":80,"tabWidth":2}`,
    "outer: for (const item of items) {\n  visit(item);\n}\n",
  )
}
