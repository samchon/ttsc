package linthost

import "testing"

// TestNoFallthroughAcceptsMarkerInSoleEmptyBlock verifies a marker inside an empty sole block suppresses the transition.
//
// Upstream valid case `case 0: { /* falls through */ } case 1: b();`: the
// block has no statements, so the eligible in-block region starts right after
// the opening brace. Locks the empty-block branch of blockInteriorStart,
// which computes the region start from the `{` token instead of a last
// statement.
//
// 1. Make the case body a sole empty block containing only the marker.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
func TestNoFallthroughAcceptsMarkerInSoleEmptyBlock(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0: { /* falls through */ }
  case 1:
    console.log(1);
    break;
}
`, "")
}
