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
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule parses the hangs broken ternary arm under arm column fixture and applies its edit; complete authored output equality rejects lost source content or punctuation alongside incorrect line layout. The owned result is: Assert the arguments hang at the arm column + one level and the close paren sits at the arm column.
// @evidence contracts/testing.md#independent-expectations The source operands and literal expected layout are authored independently of the rule printer. The fixture fixes printWidth and indentation, so expected line placement does not come from rendering the implementation under test.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Parse a return whose consequent is a call that overflows printWidth. The asserted decision is: Assert the arguments hang at the arm column + one level and the close paren sits at the arm column. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthHangsBrokenTernaryArmUnderArmColumn is one Go unit entry through the registered rule engine, parser and fix applier; it uses no installed consumer or child product host.
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
