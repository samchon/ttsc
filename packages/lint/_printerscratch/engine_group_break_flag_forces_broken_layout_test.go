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
//
// @evidence contracts/testing.md#behavioral-verification Print must emit a newline between a and b when Break is set even though both would fit.
// @evidence contracts/testing.md#independent-expectations The explicit forced-break contract overrides the three-column flat projection.
// @evidence contracts/testing.md#distinguishing-cases Forced multiline under a wide budget distinguishes this from ordinary width-driven breaking.
// @evidence contracts/testing.md#execution-ownership TestEngineGroupBreakFlagForcesBrokenLayout is a public Go unit entry selected with printer cases by TestSelectedLintUnits. It calls the Doc operation in the same Go test process, without a consumer install, native build or product host.
func TestEngineGroupBreakFlagForcesBrokenLayout(t *testing.T) {
  forced := Group(Text("a"), Line(), Text("b"))
  forced.Break = true
  got := Print(forced, DefaultPrintOptions())
  if got != "a\nb" {
    t.Fatalf("forced-break group: want %q, got %q", "a\nb", got)
  }
}
