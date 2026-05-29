package linthost

import "testing"

// TestFormatClauseJoinJoinsSingleIfBody verifies a single-statement `if`
// body on its own line is joined onto the header when it fits printWidth.
//
// Prettier writes `if (a) b();` rather than breaking a short unbraced
// body onto the next line. The rule rewrites only the whitespace gap
// after the header's `)`.
//
//  1. Parse an `if` whose body sits on the following line.
//  2. Apply format/clause-join with printWidth 80.
//  3. Assert the body joins the header line.
func TestFormatClauseJoinJoinsSingleIfBody(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/clause-join",
    "if (a)\n  b();\n",
    `{"printWidth":80,"tabWidth":2}`,
    "if (a) b();\n",
  )
}
