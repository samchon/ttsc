package linthost

import "testing"

// TestFormatClauseJoinJoinsLabeledBlockBody verifies a labeled statement joins its body even when that body is a block.
//
// A label has no group of its own in Prettier: `label: statement` is one line
// whatever the statement is. That makes it the one clause where the braced-body
// and multi-line-body abstentions must not apply, and getting it wrong leaves
// `outer:` stranded on its own line forever.
//
//  1. Parse a label whose loop body spans several lines.
//  2. Apply format/clause-join with printWidth 80.
//  3. Assert the loop joins the label line and its interior is untouched.
func TestFormatClauseJoinJoinsLabeledBlockBody(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/clause-join",
    "outer:\nfor (const item of items) {\n  break outer;\n}\n",
    `{"printWidth":80,"tabWidth":2}`,
    "outer: for (const item of items) {\n  break outer;\n}\n",
  )
}
