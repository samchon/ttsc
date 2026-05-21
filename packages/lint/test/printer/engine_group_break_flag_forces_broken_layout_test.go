package linthost

import "testing"

// TestEngineGroupBreakFlagForcesBrokenLayout verifies a Group with the
// Break flag set renders broken even when its flat form would fit the
// width budget.
//
// ConditionalGroup's hugged option relies on Break to commit a hugged
// object literal to its multi-line shape; without the flag the engine
// would re-measure the group and collapse it back to one line.
//
//  1. Build a Group whose flat form ("a b") easily fits 80 columns and
//     set its Break flag.
//  2. Print it.
//  3. Assert the group rendered broken.
func TestEngineGroupBreakFlagForcesBrokenLayout(t *testing.T) {
  forced := Group(Text("a"), Line(), Text("b"))
  forced.Break = true
  got := Print(forced, DefaultPrintOptions())
  if got != "a\nb" {
    t.Fatalf("forced-break group: want %q, got %q", "a\nb", got)
  }
}
