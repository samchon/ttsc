package linthost

import "testing"

// TestFormatPrintWidthHangsBrokenTernaryArmUnderArmColumn verifies that a
// ternary arm which breaks internally hangs its continuation under the arm
// expression's own column (one level past the `? ` marker), not under the
// chain's rung indent. Matches Prettier 3.8.3: the broken call's arguments
// indent from `props.reduce(`, and its closing paren returns to that arm
// column.
//
//  1. Parse a return whose consequent is a call that overflows printWidth 80.
//  2. Apply format/print-width.
//  3. Assert the arguments hang at the arm column + one level and the close
//     paren sits at the arm column.
// @evidence contracts/testing.md#behavioral-verification assertFixSnapshotWithOptions runs the registered format/print-width rule (printWidth 80, tabWidth 2) over a return whose ternary consequent `props.reduce(...)` exceeds the width, applies the collected fix to a real temp file and compares the whole file with an authored string: the call arguments sit at 8 spaces (arm column 6 plus one level) with a trailing comma, the closing paren returns to column 6, and the alternate `: props` is untouched.
// @evidence contracts/testing.md#independent-expectations The expected text is a hand-written Prettier-style layout with literal indentation; printWidth and tabWidth are fixed in the options JSON, so the column arithmetic comes from the authored literal and not from the printer under test.
// @evidence contracts/testing.md#distinguishing-cases One positive case only: an overflowing consequent call under a rung that must not receive the chain indent. The short alternate arm stays on its own line as the unchanged part; no non-overflowing ternary or other arm shape is checked here.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthHangsBrokenTernaryArmUnderArmColumn is one Go unit entry that builds the format/print-width engine, parses the source in-process and applies the fix through applyFindingFixes to a t.TempDir file; it installs no consumer and starts no child host.
func TestFormatPrintWidthHangsBrokenTernaryArmUnderArmColumn(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "function f() {\n"+
      "  return isArray(props)\n"+
      "    ? props.reduce((normalized, p) => ((normalized[p] = null), normalized), {} as ComponentObjectPropsOptions | ObjectEmitsOptions)\n"+
      "    : props;\n"+
      "}\n",
    `{"printWidth":80,"tabWidth":2}`,
    "function f() {\n"+
      "  return isArray(props)\n"+
      "    ? props.reduce(\n"+
      "        (normalized, p) => ((normalized[p] = null), normalized),\n"+
      "        {} as ComponentObjectPropsOptions | ObjectEmitsOptions,\n"+
      "      )\n"+
      "    : props;\n"+
      "}\n",
  )
}
