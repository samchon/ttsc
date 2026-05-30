package linthost

import "testing"

// TestFormatPrintWidthIndentsNestedConsequentTernary verifies a ternary
// whose CONSEQUENT is itself a conditional steps the inner rungs in by
// one level, then returns the outer alternate to the outer indent.
//
// `a ? (b ? c : d) : e` prints with the inner `? c`/`: d` at indent 4 and
// the outer `: e` back at indent 2. The recursion composes the Doc
// engine's Indent stack rather than wrapping the nested conditional in
// its own group, so the chain shares one break decision.
//
//  1. Parse an over-width consequent-nested ternary (printWidth 40).
//  2. Apply format/print-width.
//  3. Assert the inner rungs indent to 4 and the outer `: e` to 2.
func TestFormatPrintWidthIndentsNestedConsequentTernary(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "const r = aaaaaaaaaa ? bbbbbbbbbb ? cccccccccc : dddddddddd : eeeeeeeeee;\n",
    `{"printWidth":40,"tabWidth":2}`,
    "const r = aaaaaaaaaa\n  ? bbbbbbbbbb\n    ? cccccccccc\n    : dddddddddd\n  : eeeeeeeeee;\n",
  )
}
