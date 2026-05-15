package main

import "testing"

// TestFormatPrintWidthKeepsEmptyArrayLiteralFlat is the array analogue
// of the empty-object case. Empty arrays `[]` carry no children for
// reflow either, so the rule must abstain.
//
//  1. Configure printWidth=1.
//  2. Feed `const x = [];`.
//  3. Assert the rule emits zero findings.
func TestFormatPrintWidthKeepsEmptyArrayLiteralFlat(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/print-width",
    "const x = [];\n",
    `{"printWidth": 1}`,
  )
}
