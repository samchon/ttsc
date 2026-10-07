package linthost

import "testing"

// TestNoFallthroughRejectsMarkerBeforeLastStatement verifies a marker above the case's last statement does not suppress.
//
// The eligible trailing range starts after the case's final token; a
// `// falls through` that precedes another statement documents nothing about
// the transition. Locks against whole-case-text scanning (an explicitly
// forbidden shortcut in issue #411).
//
// 1. Place the marker between two statements of the falling-through case.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line seven when a marker precedes later logging.
// @evidence contracts/testing.md#independent-expectations A marker above a remaining consequent statement is outside the independently eligible transition trivia gap.
// @evidence contracts/testing.md#distinguishing-cases MarkedFallthroughVariants places the same policy markers after the last statement and stays clean.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsMarkerBeforeLastStatement is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughRejectsMarkerBeforeLastStatement(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    // falls through
    console.log("still runs");
  case 1:
    console.log(1);
    break;
}
`, "", 7)
}
