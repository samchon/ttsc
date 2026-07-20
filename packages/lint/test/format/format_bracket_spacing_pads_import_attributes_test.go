package linthost

import "testing"

// TestFormatBracketSpacingPadsImportAttributes verifies import attributes use
// the configured inner-brace spacing policy.
//
// ImportAttributes starts at `with`, rather than its opening brace. The rule
// must locate the brace range inside that node instead of assuming node.Pos is
// the brace itself.
//
// 1. Parse an import attribute clause without inner padding.
// 2. Apply format/bracket-spacing with spacing enabled.
// 3. Assert exactly one space appears inside the attribute braces.
func TestFormatBracketSpacingPadsImportAttributes(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/bracket-spacing",
    "import data from \"data\" with {type: \"json\"};\n",
    `{"spacing":true}`,
    "import data from \"data\" with { type: \"json\" };\n",
  )
}
