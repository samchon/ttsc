package linthost

import "testing"

// TestEngineFitsMeasuresConditionalGroupAsFirstOption verifies that
// fits measures the first alternative of a nested ConditionalGroup.
//
// The literal prefix x and first option ab occupy three columns; the
// eight-character fallback would occupy nine with the prefix. Budgets
// five and two independently distinguish admission and rejection of
// the first option in this direct measurement fixture.
//
// @evidence contracts/testing.md#behavioral-verification fits must charge the nested first alternative ab after prefix x, not the eight-character fallback.
// @evidence contracts/testing.md#independent-expectations The flat alternative contract gives a three-column projection, independently of fits.
// @evidence contracts/testing.md#distinguishing-cases Budgets five and two distinguish admission from rejection of that same doc.
// @evidence contracts/testing.md#execution-ownership TestEngineFitsMeasuresConditionalGroupAsFirstOption is one Go unit entry that calls the unexported fits directly on a literal Doc tree in-process; it parses no source and installs, builds and launches nothing.
func TestEngineFitsMeasuresConditionalGroupAsFirstOption(t *testing.T) {
  doc := Concat(Text("x"), ConditionalGroup(Text("ab"), Text("zzzzzzzz")))
  if !fits(doc, 5, 0) {
    t.Fatal("conditional group first option within budget: want true")
  }
  if fits(doc, 2, 0) {
    t.Fatal("conditional group first option overflows budget: want false")
  }
}
