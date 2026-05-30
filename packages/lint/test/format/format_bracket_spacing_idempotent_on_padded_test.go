package linthost

import "testing"

// TestFormatBracketSpacingIdempotentOnPadded verifies spacing:true is a no-op
// on an already-padded object literal, so the cascade reaches a fixed point.
//
//  1. Parse `{ x: 1 }`.
//  2. Run format/bracket-spacing with spacing:true.
//  3. Assert the rule reports nothing.
func TestFormatBracketSpacingIdempotentOnPadded(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/bracket-spacing",
    "const a = { x: 1 };\n",
    `{"spacing":true}`,
  )
}
