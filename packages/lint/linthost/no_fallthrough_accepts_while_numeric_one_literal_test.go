package linthost

import "testing"

// TestNoFallthroughAcceptsWhileNumericOneLiteral verifies `while (1)` folds to a constant-true loop test.
//
// ESLint's code path analysis folds simple Literal tests only, and `1` is one
// of them: the loop is infinite without a break, so the case end is
// unreachable. Locks the numeric branch of literalTruthiness.
//
// 1. End a case with `while (1) { console.log(0); }`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings for a bare numeric-one loop test.
// @evidence contracts/testing.md#independent-expectations Authored one is truthy under the supported literal-only policy.
// @evidence contracts/testing.md#distinguishing-cases AcceptsUnreachableLabeledBreakInWhileZero supplies the falsy numeric boundary and nonliteral rejection owns the folding limit.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsWhileNumericOneLiteral is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAcceptsWhileNumericOneLiteral(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    while (1) {
      console.log(0);
    }
  case 1:
    console.log(1);
    break;
}
`, "")
}
