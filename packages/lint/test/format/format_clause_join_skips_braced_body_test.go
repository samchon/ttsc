package linthost

import "testing"

// TestFormatClauseJoinSkipsBracedBody verifies a braced clause body is
// never collapsed onto the header line.
//
// Prettier keeps `if (a) {\n  b();\n}` block form; only an unbraced
// single statement is a join candidate. The rule abstains on a Block
// body, so a brace-on-next-line style (not this rule's concern) is left
// for the block/print-width machinery.
//
//  1. Parse an `if` with a braced body.
//  2. Run format/clause-join with printWidth 80.
//  3. Assert the rule reports nothing.
func TestFormatClauseJoinSkipsBracedBody(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/clause-join",
    "if (a) {\n  b();\n}\n",
    `{"printWidth":80,"tabWidth":2}`,
  )
}
