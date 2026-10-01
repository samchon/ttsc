package linthost

import "testing"

// TestNoFallthroughDirectiveSuppressionStillWins verifies eslint-disable-next-line keeps suppressing the finding itself.
//
// A `// eslint-disable-next-line no-fallthrough` comment is excluded from
// marker matching, but it must still work as a directive: the finding lands on
// the next case's line and the inline-disable filter drops it (upstream valid
// regression test). Locks the interplay of marker exclusion and directive
// filtering.
//
// 1. Put the disable-next-line directive directly above the fallthrough target.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings survive.
//
// @evidence contracts/testing.md#behavioral-verification No finding survives the original eslint-disable-next-line directive.
// @evidence contracts/testing.md#independent-expectations The authored directive addresses the exact next-case reporting line; exclusion from marker recognition does not disable ordinary directive filtering.
// @evidence contracts/testing.md#distinguishing-cases RejectsDirectiveCommentAsMarker retains a non-suppressing enable directive whose rule name resembles a marker.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughDirectiveSuppressionStillWins is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughDirectiveSuppressionStillWins(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    // eslint-disable-next-line no-fallthrough
  case 1:
    console.log(1);
    break;
}
`, "")
}
