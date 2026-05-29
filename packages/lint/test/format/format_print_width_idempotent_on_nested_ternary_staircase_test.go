package linthost

import "testing"

// TestFormatPrintWidthIdempotentOnNestedTernaryStaircase verifies the
// printer reproduces an already-correct staircase byte-for-byte, so the
// format cascade converges.
//
// Re-rendering the broken form must equal the source; otherwise the
// "no diff -> no edit" invariant breaks and the cascade loops. This pins
// the round-trip for the nested-alternate staircase.
//
//  1. Parse a correctly-staircased ternary chain (printWidth 40).
//  2. Run format/print-width.
//  3. Assert the rule reports nothing.
func TestFormatPrintWidthIdempotentOnNestedTernaryStaircase(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/print-width",
    "const x = aaaaaaaaaa\n  ? bbbbbbbbbb\n  : cccccccccc\n    ? dddddddddd\n    : eeeeeeeeee;\n",
    `{"printWidth":40,"tabWidth":2}`,
  )
}
