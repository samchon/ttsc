package linthost

import "testing"

// TestFormatPrintWidthKeepsShortTernaryFlat verifies a ternary that fits
// printWidth is left on one line.
//
// The chain only breaks when its flat form overflows; a short ternary
// must stay flat so the rule does not gratuitously stairstep every
// `a ? b : c`. The fast path returns before the printer is even built.
//
//  1. Parse a short ternary that fits printWidth 40.
//  2. Run format/print-width.
//  3. Assert the rule reports nothing.
func TestFormatPrintWidthKeepsShortTernaryFlat(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/print-width",
    "const x = a ? b : c;\n",
    `{"printWidth":40,"tabWidth":2}`,
  )
}
