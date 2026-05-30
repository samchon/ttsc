package linthost

import "testing"

// TestFormatBracketSpacingPadsObjectLiteral verifies bracketSpacing:true (the
// default, matching Prettier) adds one inner space to a single-line object
// literal.
//
//  1. Parse `{x: 1}`.
//  2. Apply format/bracket-spacing with spacing:true.
//  3. Assert it becomes `{ x: 1 }`.
func TestFormatBracketSpacingPadsObjectLiteral(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/bracket-spacing",
    "const a = {x: 1};\n",
    `{"spacing":true}`,
    "const a = { x: 1 };\n",
  )
}
