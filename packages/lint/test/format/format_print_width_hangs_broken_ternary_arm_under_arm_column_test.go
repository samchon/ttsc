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
