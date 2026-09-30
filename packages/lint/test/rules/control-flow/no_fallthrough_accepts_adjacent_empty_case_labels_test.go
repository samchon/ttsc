package linthost

import "testing"

// TestNoFallthroughAcceptsAdjacentEmptyCaseLabels verifies stacked empty case labels never report.
//
// `case 0: case 1:` is the idiomatic way to share one body between several
// values; ESLint always allows it (no option needed) because the empty case
// has no statements and no blank-line gap. Locks the empty-case exemption.
//
// 1. Stack two labels directly above a shared body.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings for adjacent empty labels sharing a body.
// @evidence contracts/testing.md#independent-expectations Stacked labels have no consequent statements and no blank gap; their authored empty expectation pins the supported exemption.
// @evidence contracts/testing.md#distinguishing-cases RejectsEmptyCaseFollowedByBlankLine owns the one-gap reporting twin.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsAdjacentEmptyCaseLabels is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAcceptsAdjacentEmptyCaseLabels(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
  case 1:
    console.log(1);
    break;
}
`, "")
}
