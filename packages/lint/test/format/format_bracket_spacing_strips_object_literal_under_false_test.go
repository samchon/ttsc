package linthost

import "testing"

// TestFormatBracketSpacingStripsObjectLiteralUnderFalse verifies
// bracketSpacing:false removes the inner space of a single-line object
// literal.
//
//  1. Parse `{ x: 1 }`.
//  2. Apply format/bracket-spacing with spacing:false.
//  3. Assert it becomes `{x: 1}`.
func TestFormatBracketSpacingStripsObjectLiteralUnderFalse(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/bracket-spacing",
    "const a = { x: 1 };\n",
    `{"spacing":false}`,
    "const a = {x: 1};\n",
  )
}
