package linthost

import "testing"

// TestFormatPrintWidthKeepsEmptyObjectLiteralFlat verifies an empty
// `{}` is never reflowed.
//
// The listShape printer special-cases empty children to `{}` with no
// internal whitespace. The case pins this branch: even at a tight
// printWidth, an empty object has nothing to reflow and the rule must
// emit zero findings.
//
//  1. Configure printWidth=1.
//  2. Feed `const x = {};`.
//  3. Assert the rule emits zero findings.
func TestFormatPrintWidthKeepsEmptyObjectLiteralFlat(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "formatPrintWidth",
    "const x = {};\n",
    `{"printWidth": 1}`,
  )
}
