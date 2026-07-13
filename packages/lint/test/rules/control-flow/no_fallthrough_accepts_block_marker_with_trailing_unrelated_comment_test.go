package linthost

import "testing"

// TestNoFallthroughAcceptsBlockMarkerWithTrailingUnrelatedComment verifies the sole-block marker wins even when an unrelated comment follows the block.
//
// Upstream valid case `{ a(); /* falls through */ } /* comment */ case 1:`:
// the block-interior position is checked first and already matches, so the
// non-matching last comment before the case keyword cannot cancel it. Locks
// the ordering of the two eligible marker positions.
//
// 1. Mark the fallthrough inside the sole block, then add an unrelated comment after it.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
func TestNoFallthroughAcceptsBlockMarkerWithTrailingUnrelatedComment(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0: {
    console.log(0);
    // falls through
  } /* comment */
  case 1:
    console.log(1);
    break;
}
`, "")
}
