package linthost

import "testing"

// TestNoFallthroughRejectsEmptyCaseFollowedByBlankLine verifies the default blank-line heuristic for empty cases.
//
// Upstream invalid case `case 0:\n\ncase 1:`: an empty case separated from
// the next label by a blank line reads like a forgotten body, so ESLint
// reports it unless allowEmptyCase is set. Negative twin of the
// adjacent-labels acceptance, one property away (a blank line inserted).
//
// 1. Separate an empty case from the next label with one blank line.
// 2. Run the engine with no-fallthrough enabled and default options.
// 3. Assert exactly one finding at the next case label.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line five for the blank-gap empty label.
// @evidence contracts/testing.md#independent-expectations The independently authored empty consequent plus token-line gap triggers the supported forgotten-body policy under defaults.
// @evidence contracts/testing.md#distinguishing-cases AdjacentEmptyCaseLabels, marked-gap and allowEmptyCase cases retain three distinct accepted boundaries.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsEmptyCaseFollowedByBlankLine is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughRejectsEmptyCaseFollowedByBlankLine(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:

  case 1:
    console.log(1);
    break;
}
`, "", 5)
}
