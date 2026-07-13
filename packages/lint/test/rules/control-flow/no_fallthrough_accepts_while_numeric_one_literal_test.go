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
