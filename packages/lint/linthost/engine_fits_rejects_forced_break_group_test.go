package linthost

import "testing"

// TestEngineFitsRejectsForcedBreakGroup verifies that fits rejects a
// Concat containing a Group whose Break flag is true.
//
// The fixture contains only short Text children and no line separator.
// Its generous eighty-column budget isolates the forced-flat rejection
// from text overflow; it does not assert a rendered newline.
//
// @evidence contracts/testing.md#behavioral-verification fits must reject a forced-broken group despite an eighty-column budget.
// @evidence contracts/testing.md#independent-expectations Break explicitly prohibits flat layout, independently of the text width.
// @evidence contracts/testing.md#distinguishing-cases This forced-break negative complements ordinary group collapse within a generous budget.
// @evidence contracts/testing.md#execution-ownership TestEngineFitsRejectsForcedBreakGroup is one Go unit entry that calls the unexported fits directly on a literal Doc tree in-process; it parses no source and installs, builds and launches nothing.
func TestEngineFitsRejectsForcedBreakGroup(t *testing.T) {
  forced := Group(Text("ab"))
  forced.Break = true
  if fits(Concat(Text("x"), forced), 80, 0) {
    t.Fatal("doc containing a forced-break group: want fits=false")
  }
}
