package linthost

import "testing"

// TestEnginePrintWidthDefaultsWhenZero verifies that Print substitutes
// the standard 80-column budget when PrintWidth is zero or negative.
//
// The guard prevents a division-by-zero or zero-budget confusion that
// would arise if callers construct PrintOptions with the struct literal
// default (0) rather than calling DefaultPrintOptions. A budget of 0
// would cause every group to break immediately, flooding output with
// unnecessary newlines; substituting 80 keeps the engine sane for
// callers that omit the field.
//
//  1. Build Group(Text("foo"), Line(), Text("bar")) — flat width is 7.
//  2. Print with PrintWidth=0 (the Go zero value).
//  3. Assert the group collapses flat ("foo bar"), proving the engine
//     applied the 80-column default rather than the literal 0.
func TestEnginePrintWidthDefaultsWhenZero(t *testing.T) {
  doc := Group(Text("foo"), Line(), Text("bar"))
  opts := PrintOptions{TabWidth: 2, EndOfLine: "lf"} // PrintWidth intentionally zero
  got := Print(doc, opts)
  if got != "foo bar" {
    t.Fatalf("zero PrintWidth should default to 80 (flat), got %q", got)
  }
}
