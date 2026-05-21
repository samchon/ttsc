package linthost

import "testing"

// TestEngineFitsFirstLineCountsFlatGroupLines verifies fitsFirstLine
// measures a Line inside a flat-rendering Group as a single column, not
// as the end of the first line.
//
// A Group with no hard break renders flat when it fits, so its Line
// separators collapse to spaces and stay on the first line. An earlier
// fitsFirstLine treated docGroup as a transparent wrapper and stopped at
// the first Line inside it — under-counting the first line and letting
// the ConditionalGroup selector pick a hugged option whose opening line
// actually overflows. The fix flattens a breakable Group before
// measuring it.
//
//  1. Build `Concat(Group(a Line b), Text("cdef"))` — flat width 7.
//  2. Measure it against budgets 7 and 6.
//  3. Assert it fits within 7 and not within 6.
func TestEngineFitsFirstLineCountsFlatGroupLines(t *testing.T) {
  doc := Concat(Group(Concat(Text("a"), Line(), Text("b"))), Text("cdef"))
  if !fitsFirstLine(doc, 7) {
    t.Fatalf("flat first line is 7 columns wide, want fit within 7")
  }
  if fitsFirstLine(doc, 6) {
    t.Fatalf("flat first line is 7 columns wide, want no fit within 6")
  }
}
