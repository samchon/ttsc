package linthost

import "testing"

// TestFormatPrintWidthBreaksLongObjectLiteral verifies formatPrintWidth
// rewrites a long single-line object literal to its broken multi-line
// form when its flat width exceeds the configured printWidth.
//
// The headline use case: a user wrote `const x = { aaaa: 1, … }` on
// one line, the line is 60 chars wide, and the project is configured
// for `printWidth: 40`. The rule must reflow to the Prettier-style
// vertical layout with trailing commas. A regression that misplaced
// indentation, dropped the trailing comma, or skipped the rewrite
// entirely would fail this assertion.
//
//  1. Configure printWidth=20 via options JSON.
//  2. Run the rule on a 35-char `const x = { aa: 1, bb: 2, cc: 3 };`.
//  3. Assert the rule produces the canonical Prettier vertical form
//     with a 2-space child indent and a trailing comma on the last
//     member.
func TestFormatPrintWidthBreaksLongObjectLiteral(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "const x = { aa: 1, bb: 2, cc: 3 };\n",
    `{"printWidth": 20}`,
    "const x = {\n  aa: 1,\n  bb: 2,\n  cc: 3,\n};\n",
  )
}
