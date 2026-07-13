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
