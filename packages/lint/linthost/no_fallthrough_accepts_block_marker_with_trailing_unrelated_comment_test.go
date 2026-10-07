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
//
// @evidence contracts/testing.md#behavioral-verification Zero findings when a sole block has its own trailing marker followed by an outside unrelated comment.
// @evidence contracts/testing.md#independent-expectations The block-interior marker position is independently eligible before the external trivia fallback.
// @evidence contracts/testing.md#distinguishing-cases RequiresMarkerToBeLastComment rejects the outer-trivia equivalent without an eligible block marker.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsBlockMarkerWithTrailingUnrelatedComment is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
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
