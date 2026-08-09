package linthost

import "testing"

// TestFormatClauseJoinEmitsNoShiftWhenTheColumnIsUnchanged verifies a hoisted body already at the header's column produces only the join.
//
// A zero delta must produce no indentation edit at all. Emitting a same-text
// replacement for every continuation line would make the finding contend with
// `format/indent` for bytes neither rule needs to change, and the host drops a
// whole finding whose edits collide.
//
//  1. Parse a label whose body already starts at the label's own column.
//  2. Apply format/clause-join with printWidth 80.
//  3. Assert the join lands and the body's interior is byte-identical.
func TestFormatClauseJoinEmitsNoShiftWhenTheColumnIsUnchanged(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/clause-join",
    "outer:\nfor (const item of items) {\n  visit(item);\n}\n",
    `{"printWidth":80,"tabWidth":2}`,
    "outer: for (const item of items) {\n  visit(item);\n}\n",
  )
}
