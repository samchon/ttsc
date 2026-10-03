package linthost

import "testing"

// TestEngineFitsReturnsFalseWhenRemainingNegative verifies that fits
// rejects a one-column Text when the available-column budget is -1.
//
// The direct boolean assertion establishes rejection of this literal
// input. It does not measure traversal work or distinguish the early
// guard from a later negative-budget check.
//
// @evidence contracts/testing.md#behavioral-verification fits must return false for Text x when remaining is minus one.
// @evidence contracts/testing.md#independent-expectations A negative available-column budget cannot contain the one-column literal.
// @evidence contracts/testing.md#distinguishing-cases Already-exhausted budget complements the positive and exact-budget first-line measurements.
// @evidence contracts/testing.md#execution-ownership TestEngineFitsReturnsFalseWhenRemainingNegative is one Go unit entry that calls the unexported fits directly on a literal Doc tree in-process; it parses no source and installs, builds and launches nothing.
func TestEngineFitsReturnsFalseWhenRemainingNegative(t *testing.T) {
  result := fits(Text("x"), -1, 0)
  if result != false {
    t.Fatalf("fits with remaining=-1: got true, want false")
  }
}
