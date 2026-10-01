package linthost

import "testing"

// TestEngineFitsMeasuresConditionalGroupAsFirstOption verifies the flat
// fit measurement treats a nested ConditionalGroup as its first option.
//
// A ConditionalGroup can appear inside a doc that the engine measures
// for an enclosing Group's flat-or-break decision — e.g. an array whose
// element is a hugged call. fits must give that ConditionalGroup a
// definite flat width; it uses the first (flattest) option.
//
//  1. Build a Concat of a Text and a ConditionalGroup.
//  2. Measure it with fits at a width that admits the first option and
//     at a width that does not.
//  3. Assert both verdicts.
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
