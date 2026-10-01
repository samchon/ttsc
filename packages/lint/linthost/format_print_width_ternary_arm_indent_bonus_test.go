package linthost

import "testing"

// TestFormatPrintWidthTernaryArmIndentBonus verifies ternaryArmIndentBonus
// reports a two-column bonus only for a line that opens a ternary arm.
//
// A node reflowed inside a ternary arm must hang its broken continuation
// under the arm's expression, two columns past the `?`/`:` marker. The
// bonus feeds BaseIndent; it must fire for `? ` and `: ` arm lines and
// stay zero when an ordinary line has no marker-plus-space prefix.
//
//  1. Build a source with a `? ` arm line, a `: ` arm line and a plain
//     line.
//  2. Call ternaryArmIndentBonus at a position on each.
//  3. Assert 2 for the arm lines and 0 otherwise.
//
// @evidence contracts/testing.md#behavioral-verification ternaryArmIndentBonus must recognize a leading question/colon marker followed by a space and assign exactly two columns, leaving ordinary or differently followed markers unchanged.
// @evidence contracts/testing.md#independent-expectations Literal arm prefixes define the continuation-indent convention; expected zero/two values are specified independently from the scanning algorithm.
// @evidence contracts/testing.md#distinguishing-cases Both marker kinds, ordinary/first lines, missing or tab separators, whitespace-prefixed ordinary text, empty text and a tab-indented valid arm distinguish the literal-prefix condition.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthTernaryArmIndentBonus is a selected public Go unit under TestSelectedLintUnits. This entry owns every local assertion and table row, invoking the column or source predicate in the shared process without consumer installation, a native product build or host execution.
func TestFormatPrintWidthTernaryArmIndentBonus(t *testing.T) {
  src := "x\n  ? foo()\n  : bar()\nplain\n"
  if got := ternaryArmIndentBonus(src, 6); got != 2 {
    t.Fatalf("`? ` arm line: want bonus 2, got %d", got)
  }
  if got := ternaryArmIndentBonus(src, 14); got != 2 {
    t.Fatalf("`: ` arm line: want bonus 2, got %d", got)
  }
  if got := ternaryArmIndentBonus(src, 23); got != 0 {
    t.Fatalf("plain line: want bonus 0, got %d", got)
  }
  if got := ternaryArmIndentBonus(src, 0); got != 0 {
    t.Fatalf("first line: want bonus 0, got %d", got)
  }
  for _, source := range []string{"?foo", ":bar", "?\tfoo", "  plain", ""} {
    if got := ternaryArmIndentBonus(source, 0); got != 0 {
      t.Fatalf("only a marker followed by a literal space receives a bonus: %q gave %d", source, got)
    }
  }
  if got := ternaryArmIndentBonus("\t? value", 3); got != 2 {
    t.Fatalf("a tab-indented marker plus space must receive two, got %d", got)
  }
}
