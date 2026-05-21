package linthost

import "testing"

// TestEngineSoftlineEmitsNewlineWhenGroupBreaks verifies a Softline
// inside a broken Group emits a newline followed by the current
// indentation, mirroring what Line does — but without the space that
// Line would emit in flat mode.
//
// The flat and break behaviours of Softline are symmetric duals:
// flat → empty, break → newline+indent. The engine test for the flat
// side already exists; this case pins the break side. Without it, a
// refactor that deleted the `else` branch of the Softline case in
// Print could silently make Softline a no-op in broken groups,
// merging continuation lines onto a single output line and corrupting
// every formatter path that uses Softline as a leading/trailing
// bracket separator.
//
//  1. Build Group(Text("["), Softline(), Text("ab"), Softline(),
//     Text("]")) — flat width is 4 ("[ab]").
//  2. Print with PrintWidth=3 (one column too tight) to force a break.
//  3. Assert the result is "[\\nab\\n]" — both Softlines expand to
//     newline+zero-indent.
func TestEngineSoftlineEmitsNewlineWhenGroupBreaks(t *testing.T) {
  doc := Group(Text("["), Softline(), Text("ab"), Softline(), Text("]"))
  opts := DefaultPrintOptions()
  opts.PrintWidth = 3
  got := Print(doc, opts)
  if got != "[\nab\n]" {
    t.Fatalf("broken softline mismatch: %q", got)
  }
}
