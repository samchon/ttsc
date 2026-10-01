package linthost

import "testing"

// TestFormatPrintWidthDefaultWidthIs80Columns verifies the rule uses
// 80 columns when no `printWidth` option is supplied.
//
// 80 is the Prettier default and the most common project setting; it
// is what the rule advertises in `ITtscLintPrintWidthRuleOptions.printWidth`.
// The case feeds an input crafted to be 85 characters
// flat — long enough that the default budget must reject it. A
// regression that defaulted to 0 or omitted the fallback would let
// the rule pass through unchanged.
//
//  1. Feed an object literal whose flat statement is 85 chars wide.
//  2. Run the rule with NO options blob (severity-only).
//  3. Assert the reflow lands.
//  4. Compare authored 80/81-column twins to pin the exact default boundary.
//
// @evidence contracts/testing.md#behavioral-verification The original 85-column object must break with no options. An independently authored exact-80 statement must remain silent and its one-column-longer twin must break while preserving all properties and values.
// @evidence contracts/testing.md#independent-expectations Official Prettier defaults to eighty columns; installed 3.8.3 independently retains the authored 80-column source and breaks the 81-column twin. Literal full outputs preserve each value/property and statement suffix.
// @evidence contracts/testing.md#distinguishing-cases The no-options 85-column positive is retained, and 80/81 twins distinguish the exact default threshold rather than any unspecified small budget. Custom-width and short-object hosts supply other options.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthDefaultWidthIs80Columns owns its original no-options snapshot plus exact-threshold silent input and complete-output overflow twin in the selected public Go unit population. Owning operations, engine and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatPrintWidthDefaultWidthIs80Columns(t *testing.T) {
  // 85-char statement (counted manually).
  src := "const x = { alpha: 1, bravo: 2, charlie: 3, delta: 4, echo: 5, foxtrot: 6, golf: 7 };\n"
  want := "const x = {\n  alpha: 1,\n  bravo: 2,\n  charlie: 3,\n  delta: 4,\n  echo: 5,\n  foxtrot: 6,\n  golf: 7,\n};\n"
  assertFixSnapshot(t, "format/print-width", src, want)
  assertRuleSkipsSource(t, "format/print-width", "const x = { alpha: 1, bravo: 2, charlie: 3, delta: 4, echooooo: 5, foxtrot: 6 };\n")
  assertFixSnapshot(t, "format/print-width", "const x = { alpha: 1, bravo: 2, charlie: 3, delta: 4, echoooooo: 5, foxtrot: 6 };\n", "const x = {\n  alpha: 1,\n  bravo: 2,\n  charlie: 3,\n  delta: 4,\n  echoooooo: 5,\n  foxtrot: 6,\n};\n")
}
