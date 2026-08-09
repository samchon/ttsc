package linthost

import "testing"

// TestFormatBraceContinuationIsIdempotentInBothDirections verifies source already in Prettier's shape produces no edit.
//
// The rule rewrites a gap it also reads, so a target text it fails to compare
// against would re-emit forever and exhaust the format cascade. Both directions
// need the check, because they synthesize different text.
//
//  1. Parse a joined `} else {` and a split `if (a) x();` / `else y();`.
//  2. Run format/brace-continuation on each.
//  3. Assert the rule reports nothing for either.
func TestFormatBraceContinuationIsIdempotentInBothDirections(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/brace-continuation",
    "if (a) {\n  x();\n} else {\n  y();\n}\n",
    `{"tabWidth":2}`,
  )
  assertRuleSkipsSourceWithOptions(
    t,
    "format/brace-continuation",
    "if (a) x();\nelse y();\n",
    `{"tabWidth":2}`,
  )
}
