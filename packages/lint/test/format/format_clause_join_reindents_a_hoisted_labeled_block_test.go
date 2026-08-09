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
func TestFormatClauseJoinReindentsAHoistedLabeledBlock(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/clause-join",
    "outer:\n  for (const item of items) {\n    visit(item);\n  }\n",
    `{"printWidth":80,"tabWidth":2}`,
    "outer: for (const item of items) {\n  visit(item);\n}\n",
  )
}
