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
func TestEngineFitsMeasuresConditionalGroupAsFirstOption(t *testing.T) {
  doc := Concat(Text("x"), ConditionalGroup(Text("ab"), Text("zzzzzzzz")))
  if !fits(doc, 5, 0) {
    t.Fatal("conditional group first option within budget: want true")
  }
  if fits(doc, 2, 0) {
    t.Fatal("conditional group first option overflows budget: want false")
  }
}
