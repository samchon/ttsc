package linthost

import "testing"

// TestFormatPrintWidthDefaultWidthIs80Columns verifies the rule uses
// 80 columns when no `printWidth` option is supplied.
//
// 80 is the Prettier default and the most common project setting; it
// is what the rule advertises in `ITtscLintPrintWidthRuleOptions.printWidth`.
// The case feeds an input crafted to be 90 characters
// flat — long enough that the default budget must reject it. A
// regression that defaulted to 0 or omitted the fallback would let
// the rule pass through unchanged.
//
//  1. Feed an object literal whose flat statement is 90 chars wide.
//  2. Run the rule with NO options blob (severity-only).
//  3. Assert the reflow lands.
func TestFormatPrintWidthDefaultWidthIs80Columns(t *testing.T) {
  // 90-char statement (counted manually).
  src := "const x = { alpha: 1, bravo: 2, charlie: 3, delta: 4, echo: 5, foxtrot: 6, golf: 7 };\n"
  want := "const x = {\n  alpha: 1,\n  bravo: 2,\n  charlie: 3,\n  delta: 4,\n  echo: 5,\n  foxtrot: 6,\n  golf: 7,\n};\n"
  assertFixSnapshot(t, "formatPrintWidth", src, want)
}
