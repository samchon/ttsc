package linthost

import "testing"

// TestEngineFitsFirstLineCountsFlatGroupLines verifies fitsFirstLine
// measures a Line inside a flat-rendering Group as a single column, not
// as the end of the first line.
//
// The literal nested a-space-b group followed by cdef is seven columns.
// Budgets seven and six distinguish full flat measurement from stopping at
// the Group's Line before counting the remaining literal text.
//
// @evidence contracts/testing.md#behavioral-verification fitsFirstLine must admit seven columns and reject six for a flat nested group followed by cdef.
// @evidence contracts/testing.md#independent-expectations The independent arithmetic is one plus one space plus one plus four characters.
// @evidence contracts/testing.md#distinguishing-cases The adjacent exact-width and one-column-short budgets distinguish premature stopping at Line from full flat measurement.
// @evidence contracts/testing.md#execution-ownership TestEngineFitsFirstLineCountsFlatGroupLines is one Go unit entry that calls the unexported fitsFirstLine directly on a literal Doc tree in-process; it parses no source and installs, builds and launches nothing.
func TestEngineFitsFirstLineCountsFlatGroupLines(t *testing.T) {
  doc := Concat(Group(Concat(Text("a"), Line(), Text("b"))), Text("cdef"))
  if !fitsFirstLine(doc, 7) {
    t.Fatalf("flat first line is 7 columns wide, want fit within 7")
  }
  if fitsFirstLine(doc, 6) {
    t.Fatalf("flat first line is 7 columns wide, want no fit within 6")
  }
}
