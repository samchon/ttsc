package linthost

import "testing"

// TestNoFallthroughUnusedCheckIgnoresNonMarkerComment verifies the unused-comment check only fires on marker-matching comments.
//
// Upstream valid case: `// just a comment` after a break is an ordinary
// comment, not a fallthrough marker, so reportUnusedFallthroughComment has
// nothing to say about it. Negative twin of the unused-comment report, one
// property away (the comment text no longer matches the pattern).
//
// 1. Put an unrelated comment between a breaking case and the next label.
// 2. Run the engine with options {"reportUnusedFallthroughComment":true}.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings report for an unrelated comment after break with unused-marker checking enabled.
// @evidence contracts/testing.md#independent-expectations The authored just-a-comment text fails the marker policy, independently excluding an unused-marker finding despite closed completion.
// @evidence contracts/testing.md#distinguishing-cases ReportsUnusedFallthroughComment retains matching marker wording in the same completion context.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughUnusedCheckIgnoresNonMarkerComment is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughUnusedCheckIgnoresNonMarkerComment(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  // just a comment
  case 1:
    console.log(1);
}
`, `{"reportUnusedFallthroughComment":true}`)
}
