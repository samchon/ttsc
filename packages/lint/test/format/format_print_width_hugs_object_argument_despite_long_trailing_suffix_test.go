package linthost

import "testing"

// TestFormatPrintWidthHugsObjectArgumentDespiteLongTrailingSuffix
// verifies a multi-line reflow keeps hugging its object argument even
// when a long un-movable suffix (` satisfies T;`) follows the call.
//
// The suffix lands on the reflow's short last line, never on the hugged
// opening line. An earlier revision shrank the whole printWidth budget
// by the suffix width, which starved the interior layout and exploded
// every argument onto its own line — diverging from Prettier, which
// charges the suffix only against the last line. The rule now renders
// at the full budget and only re-measures the suffix when the reflow
// collapses to a single line.
//
//  1. Configure printWidth=30; the suffix ` satisfies …;` is 28 wide.
//  2. Feed an exploded call followed by the long suffix.
//  3. Assert the object hugs the parens instead of exploding.
func TestFormatPrintWidthHugsObjectArgumentDespiteLongTrailingSuffix(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "wrap(\n  {\n    a: 1,\n  },\n) satisfies VeryLongTypeName;\n",
    `{"printWidth": 30}`,
    "wrap({\n  a: 1,\n}) satisfies VeryLongTypeName;\n",
  )
}
