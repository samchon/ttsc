package linthost

import "testing"

// TestFormatBracketSpacingPadsDestructure verifies bracketSpacing:true pads a
// single-line object binding pattern (destructuring).
//
//  1. Parse `const {x, y} = obj`.
//  2. Apply format/bracket-spacing with spacing:true.
//  3. Assert it becomes `const { x, y } = obj`.
func TestFormatBracketSpacingPadsDestructure(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/bracket-spacing",
    "const {x, y} = obj;\n",
    `{"spacing":true}`,
    "const { x, y } = obj;\n",
  )
}
