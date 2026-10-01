package linthost

import "testing"

// TestEngineFitsRejectsForcedBreakGroup verifies the flat fit
// measurement treats a forced-broken Group as unable to render flat.
//
// A Group with Break set always renders broken, so any enclosing
// measurement must count it as a hard line break — otherwise an outer
// group could commit to a flat layout that in fact contains a newline.
//
//  1. Build a Concat of a Text and a forced-broken Group.
//  2. Measure it with fits at a generous width.
//  3. Assert fits reports false.
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
