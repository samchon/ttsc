package linthost

import "testing"

// TestFormatBracketSpacingLeavesEmptyObject verifies an empty `{}` is left
// untouched under both modes — there is no interior to pad, matching
// Prettier (`{}` stays `{}`, never `{ }`).
//
//  1. Parse `const b = {}`.
//  2. Run format/bracket-spacing with spacing:true.
//  3. Assert the rule reports nothing.
func TestFormatBracketSpacingLeavesEmptyObject(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/bracket-spacing",
    "const b = {};\n",
    `{"spacing":true}`,
  )
}
