package linthost

import "testing"

// TestNoFallthroughRejectsNonLiteralConstantCondition verifies `while (!0)` is not constant-folded.
//
// ESLint's getBooleanValueIfSimpleConstant folds bare Literal nodes only —
// `!0` is a unary expression, so the loop is treated as exitable and the case
// falls through. Negative twin of the `while (1)` acceptance, one property
// away (the literal wrapped in a negation). Locks the folding boundary so we
// never fold more than the oracle does.
//
// 1. End a case with `while (!0) { console.log(0); }`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
func TestNoFallthroughRejectsNonLiteralConstantCondition(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    while (!0) {
      console.log(0);
    }
  case 1:
    console.log(1);
    break;
}
`, "", 7)
}
