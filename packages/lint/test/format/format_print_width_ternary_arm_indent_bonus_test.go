package linthost

import "testing"

// TestFormatPrintWidthTernaryArmIndentBonus verifies ternaryArmIndentBonus
// reports a two-column bonus only for a line that opens a ternary arm.
//
// A node reflowed inside a ternary arm must hang its broken continuation
// under the arm's expression, two columns past the `?`/`:` marker. The
// bonus feeds BaseIndent; it must fire for `? ` and `: ` arm lines and
// stay zero for an ordinary line and the file's first line.
//
//  1. Build a source with a `? ` arm line, a `: ` arm line and a plain
//     line.
//  2. Call ternaryArmIndentBonus at a position on each.
//  3. Assert 2 for the arm lines and 0 otherwise.
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
}
